import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import bcrypt from "npm:bcryptjs@2.4.3";

const url = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const clinicCode = (Deno.env.get("CLINIC_CODE") || "SAFFARI").trim().toUpperCase();
const origins = new Set(["https://app.mhsaffari.ir","https://doctor-app.mhsaffari.ir"]);
const patientOrigin = "https://app.mhsaffari.ir";
const APPOINTMENT_TYPES = new Set(["in_person","text"]);
const EITAA_URL = "https://eitaa.com/Dr_Saffari";
const headers = (origin: string | null) => ({
  "Access-Control-Allow-Origin": origin && origins.has(origin) ? origin : "https://app.mhsaffari.ir",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Vary": "Origin",
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store"
});
const json = (data: unknown, status=200, origin: string|null=null) => new Response(JSON.stringify(data), {status,headers:headers(origin)});
const normalize = (v: unknown) => String(v ?? "").replace(/[۰-۹]/g,c=>String(c.charCodeAt(0)-0x06f0)).replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-0x0660)).replace(/\s/g,"");
const clean = (v: unknown, max=4000) => String(v ?? "").trim().slice(0,max);
const mobileOk=(v:string)=>/^09\d{9}$/.test(v);
const nidOk=(v:string)=>/^\d{10}$/.test(v);
const dateOk=(v:string)=>/^\d{4}-\d{2}-\d{2}$/.test(v);
const timeOk=(v:string)=>/^([01]\d|2[0-3]):[0-5]\d$/.test(v);
async function audit(userId:string,role:string,action:string,type:string,id:string,metadata={}) {
  await db.from("audit_events").insert({actor_id:userId,actor_role:role,action,subject_type:type,subject_id:id,metadata});
}
async function issueSession(userId:string,role:string) {
  const token=Array.from(crypto.getRandomValues(new Uint8Array(32))).map(x=>x.toString(16).padStart(2,"0")).join("");
  const tokenHash=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(token));
  const hash=Array.from(new Uint8Array(tokenHash)).map(x=>x.toString(16).padStart(2,"0")).join("");
  const sessionTable = role === "doctor" ? "doctor_sessions" : "sessions";
  const {error}=await db.from(sessionTable).insert({token_hash:hash,user_id:userId,role,expires_at:new Date(Date.now()+8*60*60*1000).toISOString()});
  if(error) throw error;
  return token;
}
async function auth(req:Request, roles:string[]=[]){
  const token=(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"");
  if(!token) return null;
  const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(token));
  const hash=Array.from(new Uint8Array(digest)).map(x=>x.toString(16).padStart(2,"0")).join("");
  const sessionTable = roles.length === 1 && roles[0] === "doctor" ? "doctor_sessions" : "sessions";
  const {data}=await db.from(sessionTable).select("user_id,role,expires_at").eq("token_hash",hash).maybeSingle();
  if(!data || new Date(data.expires_at).getTime()<Date.now() || (roles.length&&!roles.includes(data.role))) return null;
  return {sub:data.user_id,role:data.role};
}
async function patientActive(user:any){
 const {data}=await db.from("patients").select("id,status").eq("id",user.sub).maybeSingle();
 return data?.status==="active";
}
function safePatient(p:any,doctor=false){const x={id:p.id,firstName:p.first_name,lastName:p.last_name,mobile:p.mobile,diseaseCode:p.disease_code,status:p.status,createdAt:p.created_at};if(doctor)x.nationalId=p.national_id?"••••••"+String(p.national_id).slice(-4):"";return x;}
function safeAppointment(a:any){
 const appointmentType = a.appointment_type === "text" ? "text" : "in_person";
 return {id:a.id,patientId:a.patient_id,patientName:a.patient_name,patientMobile:a.patient_mobile,preferredDate:a.preferred_date,preferredTime:a.preferred_time,reason:a.reason,status:a.status,doctorNote:a.doctor_note||"",appointmentType,consultationUrl:appointmentType==="text"&&a.status==="confirmed"?EITAA_URL:null,createdAt:a.created_at};
}
const sha256Hex = async (value:string) => {
 const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
 return Array.from(new Uint8Array(digest)).map(x=>x.toString(16).padStart(2,"0")).join("");
};
const clientIp = (req:Request) => req.headers.get("cf-connecting-ip")?.trim() || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
async function rateAllowed(req:Request, scope:string, limit:number, windowSeconds:number) {
 const bucketHash = await sha256Hex(scope + ":" + clientIp(req));
 const {data,error}=await db.rpc("consume_neurocare_rate_limit",{p_bucket_hash:bucketHash,p_limit:limit,p_window_seconds:windowSeconds});
 if(error) { console.error("rate limit service failed",error.message); throw error; }
 return data === true;
}
async function verifyCaptcha(req:Request, body:any) {
 if(req.headers.get("origin") !== patientOrigin) return true; // preserve compatibility with existing native patient clients
 const id=clean(body.captchaId,64), answer=normalize(body.captchaAnswer);
 if(!id || !/^\d{1,2}$/.test(answer)) return false;
 const ipHash=await sha256Hex(clientIp(req));
 const {data:challenge,error}=await db.from("captcha_challenges").select("id,answer_hash").eq("id",id).eq("ip_hash",ipHash).is("used_at",null).gt("expires_at",new Date().toISOString()).maybeSingle();
 if(error) throw error;
 if(!challenge) return false;
 const {data:used,error:usedError}=await db.from("captcha_challenges").update({used_at:new Date().toISOString()}).eq("id",id).is("used_at",null).select("id").maybeSingle();
 if(usedError) throw usedError;
 if(!used) return false;
 return (await sha256Hex(id + ":" + answer)) === challenge.answer_hash;
}
function patientPasswordOk(value:string) {
 return value.length >= 8 && value.length <= 12 && /^[\x21-\x7e]+$/.test(value) &&
   /[A-Za-z]/.test(value) && /\d/.test(value) && /[^A-Za-z0-9]/.test(value);
}
const timeMinutes = (value:unknown) => { const p=String(value||"").slice(0,5).split(":").map(Number); return p.length===2&&p.every(Number.isFinite)?p[0]*60+p[1]:-1; };
const fmtMinutes = (n:number) => String(Math.floor(n/60)).padStart(2,"0")+":"+String(n%60).padStart(2,"0");
function tehranNow() {
 const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Tehran",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(new Date()).filter(p=>p.type!=="literal").map(p=>[p.type,p.value]));
 return {date:String(parts.year)+"-"+String(parts.month)+"-"+String(parts.day),time:String(parts.hour)+":"+String(parts.minute)};
}
async function availableSlots(type:string) {
 if(!APPOINTMENT_TYPES.has(type)) return [];
 const {data:availability,error:availabilityError}=await db.from("doctor_availability").select("appointment_type,day_of_week,start_time,end_time,slot_minutes").eq("appointment_type",type).eq("is_active",true);
 if(availabilityError) throw availabilityError;
 if(!availability?.length) return [];
 const now=tehranNow(), base=new Date(now.date+"T12:00:00.000Z");
 const endDate=new Date(base.getTime()+41*86400000).toISOString().slice(0,10);
 const {data:bookings,error:bookingError}=await db.from("appointments").select("preferred_date,preferred_time,appointment_type,status").eq("appointment_type",type).gte("preferred_date",now.date).lte("preferred_date",endDate).in("status",["requested","confirmed"]);
 if(bookingError) throw bookingError;
 const booked=new Set((bookings||[]).map((a:any)=>String(a.preferred_date).slice(0,10)+"|"+String(a.preferred_time).slice(0,5)));
 const {data:leaves,error:leaveError}=await db.from("doctor_leave_ranges").select("start_date,end_date,appointment_type").eq("is_active",true).lte("start_date",endDate).gte("end_date",now.date);
 if(leaveError) throw leaveError;
 const seen=new Set<string>(), slots:any[]=[];
 for(let dayOffset=0;dayOffset<42;dayOffset++){
  const date=new Date(base.getTime()+dayOffset*86400000).toISOString().slice(0,10);
  if((leaves||[]).some((x:any)=>date>=String(x.start_date).slice(0,10)&&date<=String(x.end_date).slice(0,10)&&(!x.appointment_type||x.appointment_type===type))) continue;
  const dayOfWeek=new Date(date+"T12:00:00.000Z").getUTCDay();
  for(const row of availability.filter((x:any)=>Number(x.day_of_week)===dayOfWeek)){
   const start=timeMinutes(row.start_time), end=timeMinutes(row.end_time), step=Number(row.slot_minutes)||30;
   for(let m=start;m+step<=end;m+=step){
    const time=fmtMinutes(m), key=date+"|"+time;
    if(date===now.date && time<=now.time) continue;
    if(booked.has(key)||seen.has(key)) continue;
    seen.add(key); slots.push({date,time,appointmentType:type});
   }
  }
 }
 return slots.sort((a,b)=>(a.date+"|"+a.time).localeCompare(b.date+"|"+b.time)).slice(0,250);
}
Deno.serve(async (req:Request)=>{
 const origin=req.headers.get("origin");
 if(req.method==="OPTIONS") return new Response(null,{status:204,headers:headers(origin)});
 if(origin && !origins.has(origin)) return json({error:"origin_not_allowed"},403,origin);
 try {
  const urlObj=new URL(req.url);
  let incomingPath=urlObj.pathname;
  const functionMarker="/functions/v1/neurocare-api";
  const markerIndex=incomingPath.indexOf(functionMarker);
  if(markerIndex>=0){
   incomingPath=incomingPath.slice(markerIndex+functionMarker.length);
  } else {
   const shortMarker="/neurocare-api";
   const shortIndex=incomingPath.indexOf(shortMarker);
   if(shortIndex>=0) incomingPath=incomingPath.slice(shortIndex+shortMarker.length);
  }
  let path=incomingPath.replace(/\/+$/,"") || "/health";

  if((path==="/health" || path==="/v1/health") && req.method==="GET") return json({status:"ok",service:"saffari-neurocare-supabase",version:"1.0.0"},200,origin);
  const body=req.method==="GET"?{}:await req.json().catch(()=>({}));
  if(path==="/v1/captcha/challenge"&&req.method==="POST"){
   if(!(await rateAllowed(req,"captcha",60,3600)))return json({error:"too_many_attempts"},429,origin);
   const left=crypto.getRandomValues(new Uint8Array(1))[0]%8+2,right=crypto.getRandomValues(new Uint8Array(1))[0]%8+2;
   const id=crypto.randomUUID(),ipHash=await sha256Hex(clientIp(req)),answerHash=await sha256Hex(id+":"+(left+right));
   const {error}=await db.from("captcha_challenges").insert({id,answer_hash:answerHash,ip_hash:ipHash,expires_at:new Date(Date.now()+180000).toISOString()});
   if(error)throw error;
   await db.from("captcha_challenges").delete().lt("expires_at",new Date(Date.now()-86400000).toISOString());
   return json({challengeId:id,question:String(left)+" + "+String(right),expiresInSeconds:180},200,origin);
  }
  if(path==="/v1/patients/register"&&req.method==="POST"){
   const firstName=clean(body.firstName,100),lastName=clean(body.lastName,100),mobile=normalize(body.mobile),nationalId=normalize(body.nationalId),diseaseCode=clean(body.diseaseCode||"unassigned",30),clinic=clean(body.clinicCode,40).toUpperCase();
   const webClient=origin===patientOrigin, submittedPassword=String(body.password||"");
   if(!firstName||!lastName||!mobileOk(mobile)||!nidOk(nationalId)||clinic!==clinicCode||!["migraine","ms","epilepsy","parkinson","cognition","low_back_pain","stroke","other","unassigned"].includes(diseaseCode))return json({error:"invalid_registration_data"},400,origin);
   if(!(await rateAllowed(req,"patient-register",6,3600)))return json({error:"too_many_attempts"},429,origin);
   if(webClient && !(await verifyCaptcha(req,body)))return json({error:"invalid_captcha"},400,origin);
   if(webClient && !patientPasswordOk(submittedPassword))return json({error:"invalid_patient_password"},400,origin);
   const {data:dup}=await db.from("patients").select("id").or("mobile.eq."+mobile+",national_id.eq."+nationalId).limit(1);
   if(dup?.length)return json({error:"patient_already_registered"},409,origin);
   const password=webClient?submittedPassword:(submittedPassword||nationalId);
   const hash=await bcrypt.hash(password,12);
   const {data:p,error}=await db.from("patients").insert({first_name:firstName,last_name:lastName,mobile,national_id:nationalId,password_hash:hash,disease_code:diseaseCode,status:"pending_review"}).select("*").single();
   if(error)throw error;
   const token=await issueSession(p.id,"patient"); await audit(p.id,"patient","patient.register","patient",p.id);
   return json({patient:safePatient(p),token},201,origin);
  }
  if(path==="/v1/patients/login"&&req.method==="POST"){
   const suppliedMobile=normalize(body.mobile),suppliedNationalId=normalize(body.nationalId);
   const loginByNationalId=!body.mobile && nidOk(suppliedNationalId);
   const identifier=loginByNationalId?suppliedNationalId:suppliedMobile;
   const password=String(body.password||(!loginByNationalId?(body.nationalId||""):""));
   if((loginByNationalId?!nidOk(identifier):!mobileOk(identifier))||!password)return json({error:"invalid_credentials"},400,origin);
   if(!(await rateAllowed(req,"patient-login",20,900)))return json({error:"too_many_attempts"},429,origin);
   if(origin===patientOrigin && !(await verifyCaptcha(req,body)))return json({error:"invalid_captcha"},400,origin);
   const {data:p}=await db.from("patients").select("*").eq(loginByNationalId?"national_id":"mobile",identifier).maybeSingle();
   if(!p||!(await bcrypt.compare(password,p.password_hash)))return json({error:"invalid_credentials"},401,origin);
   const token=await issueSession(p.id,"patient");await audit(p.id,"patient","patient.login","patient",p.id);
   return json({patient:safePatient(p),token},200,origin);
  }
  if(path==="/v1/doctor/login"&&req.method==="POST"){
   const hash=Deno.env.get("DOCTOR_PASSWORD_HASH")||"";
   const code=clean(body.clinicCode,40).toUpperCase(),password=String(body.password||"");
   if(!hash)return json({error:"doctor_login_not_configured"},503,origin);
   if(!(await rateAllowed(req,"doctor-login",10,900)))return json({error:"too_many_attempts"},429,origin);
   if(code!==clinicCode||!(await bcrypt.compare(password,hash)))return json({error:"invalid_credentials"},401,origin);
   const token=await issueSession("00000000-0000-4000-8000-000000000001","doctor");await audit("00000000-0000-4000-8000-000000000001","doctor","doctor.login","session","00000000-0000-4000-8000-000000000001");
   return json({token},200,origin);
  }
  const patient=await auth(req,["patient"]), doctor=await auth(req,["doctor"]), user=patient||doctor;
  if(path==="/v1/patients/me"&&req.method==="GET"){if(!patient)return json({error:"unauthorized"},401,origin);const {data:p}=await db.from("patients").select("*").eq("id",patient.sub).maybeSingle();return p?json({patient:safePatient(p)},200,origin):json({error:"patient_not_found"},404,origin);}
  if(path.startsWith("/v1/patients/")&&!patient) return json({error:"unauthorized"},401,origin);
  if(path.startsWith("/v1/doctor/")&&!doctor) return json({error:"unauthorized"},401,origin);
  if(!user)return json({error:"unauthorized"},401,origin);
  if(patient && path!=="/v1/patients/me" && !(await patientActive(patient)))return json({error:"awaiting_doctor_approval"},403,origin);
  if(path==="/v1/doctor/patients"&&req.method==="GET"){
   const search=clean(urlObj.searchParams.get("q"),80).replace(/[۰-۹]/g,c=>String(c.charCodeAt(0)-0x06f0)).replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-0x0660)).replace(/[^\p{L}\p{N}\s-]/gu," ").trim();
   let query=db.from("patients").select("*").order("created_at",{ascending:false});
   if(search){
    const terms=search.split(/\s+/).filter(Boolean).slice(0,5),filters:string[]=[];
    for(const term of terms) filters.push("first_name.ilike.%"+term+"%","last_name.ilike.%"+term+"%","mobile.ilike.%"+term+"%","national_id.ilike.%"+term+"%");
    query=query.or([...new Set(filters)].join(",")).limit(100);
   }else query=query.limit(300);
   const {data,error}=await query;if(error)throw error;
   return json({patients:(data||[]).map((p:any)=>safePatient(p,true))},200,origin);
  }
  if(path==="/v1/doctor/appointments"&&req.method==="GET"){
   const {data,error}=await db.from("appointments").select("*,patients(first_name,last_name,mobile)").order("preferred_date").limit(300);if(error)throw error;
   const today=tehranNow().date;
   const upcoming=(data||[]).filter((a:any)=>a.status==="requested"||(a.status==="confirmed"&&String(a.preferred_date).slice(0,10)>=today));
   return json({appointments:upcoming.map((a:any)=>safeAppointment({...a,patient_name:[a.patients?.first_name,a.patients?.last_name].filter(Boolean).join(" "),patient_mobile:a.patients?.mobile}))},200,origin);
  }
  if(path==="/v1/patients/availability"&&req.method==="GET"){
   const type=urlObj.searchParams.get("type")||"in_person";
   if(!APPOINTMENT_TYPES.has(type))return json({error:"invalid_appointment_type"},400,origin);
   return json({slots:await availableSlots(type)},200,origin);
  }
  if(path==="/v1/doctor/availability"&&req.method==="GET"){
   const {data,error}=await db.from("doctor_availability").select("*").order("day_of_week").order("appointment_type").order("start_time");
   if(error)throw error;return json({availability:data||[]},200,origin);
  }
  if(path==="/v1/doctor/availability"&&req.method==="POST"){
   const type=clean(body.appointmentType,20),day=Number(body.dayOfWeek),start=clean(body.startTime,5),end=clean(body.endTime,5),minutes=Number(body.slotMinutes||30);
   if(!APPOINTMENT_TYPES.has(type)||!Number.isInteger(day)||day<0||day>6||!timeOk(start)||!timeOk(end)||timeMinutes(start)>=timeMinutes(end)||!Number.isInteger(minutes)||minutes<10||minutes>120)return json({error:"invalid_availability"},400,origin);
   const {data,error}=await db.from("doctor_availability").upsert({appointment_type:type,day_of_week:day,start_time:start,end_time:end,slot_minutes:minutes,is_active:true,updated_at:new Date().toISOString()},{onConflict:"appointment_type,day_of_week,start_time,end_time"}).select("*").single();
   if(error)throw error;return json({availability:data},201,origin);
  }
  const availabilityToggle=path.match(/^\/v1\/doctor\/availability\/([0-9a-f-]{36})$/i);
  if(availabilityToggle&&req.method==="PATCH"){
   const active=body.isActive===true;
   const {data,error}=await db.from("doctor_availability").update({is_active:active,updated_at:new Date().toISOString()}).eq("id",availabilityToggle[1]).select("*").maybeSingle();
   if(error)throw error;if(!data)return json({error:"availability_not_found"},404,origin);
   return json({availability:data},200,origin);
  }
  if(path==="/v1/doctor/leaves"&&req.method==="GET"){
   const {data,error}=await db.from("doctor_leave_ranges").select("*").order("start_date").limit(300);
   if(error)throw error;return json({leaves:data||[]},200,origin);
  }
  if(path==="/v1/doctor/leaves"&&req.method==="POST"){
   const start=clean(body.startDate,10),end=clean(body.endDate,10),typeRaw=clean(body.appointmentType,20),type=typeRaw||null,reason=clean(body.reason,300);
   if(!dateOk(start)||!dateOk(end)||start>end||(type&&!APPOINTMENT_TYPES.has(type)))return json({error:"invalid_leave_range"},400,origin);
   const {data:leave,error}=await db.from("doctor_leave_ranges").insert({start_date:start,end_date:end,appointment_type:type,reason,is_active:true}).select("*").single();
   if(error)throw error;await audit(doctor!.sub,"doctor","doctor.leave.create","doctor_leave_range",leave.id,{startDate:start,endDate:end,appointmentType:type});
   return json({leave},201,origin);
  }
  const leaveToggle=path.match(/^\/v1\/doctor\/leaves\/([0-9a-f-]{36})$/i);
  if(leaveToggle&&req.method==="PATCH"){
   const active=body.isActive===true;
   const {data:leave,error}=await db.from("doctor_leave_ranges").update({is_active:active,updated_at:new Date().toISOString()}).eq("id",leaveToggle[1]).select("*").maybeSingle();
   if(error)throw error;if(!leave)return json({error:"leave_not_found"},404,origin);
   return json({leave},200,origin);
  }
  const myAppts="/v1/patients/appointments";
  if(path===myAppts&&req.method==="GET"){const {data,error}=await db.from("appointments").select("*").eq("patient_id",patient!.sub).order("preferred_date",{ascending:false}).limit(100);if(error)throw error;return json({appointments:(data||[]).map(safeAppointment)},200,origin);}
  if(path===myAppts&&req.method==="POST"){
   const d=clean(body.preferredDate,10),t=clean(body.preferredTime,5),type=clean(body.appointmentType||"in_person",20);
   let reason=clean(body.reason,500);
   if(!dateOk(d)||!timeOk(t)||!APPOINTMENT_TYPES.has(type))return json({error:"invalid_appointment_request"},400,origin);
   if(!reason)reason=type==="text"?"درخواست مشاوره متنی":"درخواست نوبت حضوری";
   if(body.appointmentType && !(await availableSlots(type)).some((slot:any)=>slot.date===d&&slot.time===t))return json({error:"slot_unavailable"},409,origin);
   const {data:a,error}=await db.from("appointments").insert({patient_id:patient!.sub,preferred_date:d,preferred_time:t,reason,appointment_type:type}).select("*").single();
   if(error){if(error.code==="23505")return json({error:"slot_unavailable"},409,origin);throw error;}
   await audit(patient!.sub,"patient","appointment.request","appointment",a.id,{appointmentType:type});
   return json({appointment:safeAppointment(a)},201,origin);
  }
  if(path==="/v1/doctor/appointments"&&req.method==="PATCH")return json({error:"use_appointment_id_route"},400,origin);
  const reportPath="/v1/patients/reports";
  if(reportPath===path&&req.method==="GET"){const {data,error}=await db.from("symptom_reports").select("*").eq("patient_id",patient!.sub).order("submitted_at",{ascending:false}).limit(100);if(error)throw error;return json({reports:data||[]},200,origin);}
  if(reportPath===path&&req.method==="POST"){
   const reportType=clean(body.reportType||"pre_visit",20),severity=body.severity==null||body.severity===""?null:Number(body.severity),rawNotes=String(body.notes||""),notes=clean(rawNotes,200),symptoms=Array.isArray(body.symptoms)?body.symptoms.map((x:any)=>clean(x,60)).filter(Boolean).slice(0,30):[],occurredOn=clean(body.occurredOn,10);
   if(rawNotes.length>200)return json({error:"report_notes_too_long"},400,origin);
   if(!["symptom","pre_visit"].includes(reportType)||(severity!==null&&(!Number.isInteger(severity)||severity<1||severity>10))||(!notes&&!symptoms.length))return json({error:"invalid_report"},400,origin);
   const {data:r,error}=await db.from("symptom_reports").insert({patient_id:patient!.sub,report_type:reportType,severity,symptoms,notes,occurred_on:occurredOn||null}).select("*").single();if(error)throw error;await audit(patient!.sub,"patient","patient.report.create","symptom_report",r.id);return json({report:r},201,origin);
  }
  const m=path.match(/^\/v1\/doctor\/patients\/([0-9a-f-]{36})(?:\/(reports|notes|treatment-plan|medications|status))?$/i);
  if(m&&doctor){
   const id=m[1],sub=m[2]||"", {data:exists}=await db.from("patients").select("id").eq("id",id).maybeSingle();if(!exists)return json({error:"patient_not_found"},404,origin);
    if(!sub&&req.method==="DELETE"){
     const {data:removed,error:removeError}=await db.from("patients").delete().eq("id",id).select("id").maybeSingle();
     if(removeError)throw removeError;if(!removed)return json({error:"patient_not_found"},404,origin);
     const {error:auditCleanupError}=await db.from("audit_events").delete().or("actor_id.eq."+id+",subject_id.eq."+id);
     if(auditCleanupError)console.error("patient audit cleanup failed",auditCleanupError.message);
     await audit(doctor!.sub,"doctor","patient.account.delete","patient","deleted",{recordsPurged:true});
     return json({deleted:true},200,origin);
    }
   if(sub==="status"&&req.method==="PATCH"){const status=clean(body.status,30);if(!["pending_review","active","rejected"].includes(status))return json({error:"invalid_status"},400,origin);const {data:p,error}=await db.from("patients").update({status,updated_at:new Date().toISOString()}).eq("id",id).select("*").single();if(error)throw error;await audit(doctor.sub,"doctor","patient.status.update","patient",id,{status});return json({patient:safePatient(p,true)},200,origin);}
   if(sub==="reports"&&req.method==="GET"){const {data,error}=await db.from("symptom_reports").select("*").eq("patient_id",id).order("submitted_at",{ascending:false}).limit(100);if(error)throw error;return json({reports:data||[]},200,origin);}
   if(sub==="notes"&&req.method==="GET"){const {data,error}=await db.from("clinical_notes").select("*").eq("patient_id",id).order("created_at",{ascending:false}).limit(100);if(error)throw error;return json({notes:data||[]},200,origin);}
   if(sub==="notes"&&req.method==="POST"){const note=clean(body.noteText,5000),visible=body.visibleToPatient===true;if(note.length<3)return json({error:"note_too_short"},400,origin);const {data:n,error}=await db.from("clinical_notes").insert({patient_id:id,doctor_label:Deno.env.get("DOCTOR_DISPLAY_NAME")||"پزشک معالج",note_text:note,visible_to_patient:visible}).select("*").single();if(error)throw error;await audit(doctor.sub,"doctor","clinical_note.create","clinical_note",n.id);return json({note:n},201,origin);}
   if(sub==="treatment-plan"&&req.method==="POST"){const title=clean(body.title,200),instructions=clean(body.instructions,4000),follow=clean(body.followUpDate,10);if(!title||!instructions||(follow&&!dateOk(follow)))return json({error:"invalid_treatment_plan"},400,origin);const {data:p,error}=await db.from("treatment_plans").insert({patient_id:id,title,instructions,follow_up_date:follow||null}).select("*").single();if(error)throw error;return json({plan:p},201,origin);}
   if(sub==="medications"&&req.method==="POST"){const name=clean(body.name,200),dose=clean(body.dose,200),instructions=clean(body.instructions,1000);if(!name||!dose)return json({error:"invalid_medication"},400,origin);const {data:p,error}=await db.from("medications").insert({patient_id:id,name,dose,instructions}).select("*").single();if(error)throw error;return json({medication:p},201,origin);}
   if(!sub&&req.method==="GET"){const {data:p,error}=await db.from("patients").select("*").eq("id",id).single();if(error)throw error;return json({patient:safePatient(p,true)},200,origin);}
  }
  if(path==="/v1/patients/notes"&&req.method==="GET"){const {data,error}=await db.from("clinical_notes").select("id,doctor_label,note_text,created_at").eq("patient_id",patient!.sub).eq("visible_to_patient",true).order("created_at",{ascending:false}).limit(100);if(error)throw error;return json({notes:data||[]},200,origin);}
  if(path==="/v1/patients/treatment-plan"&&req.method==="GET"){const {data,error}=await db.from("treatment_plans").select("id,title,instructions,follow_up_date,created_at,updated_at").eq("patient_id",patient!.sub).eq("active",true).order("created_at",{ascending:false}).limit(50);if(error)throw error;return json({plans:data||[]},200,origin);}
  if(path==="/v1/patients/medications"&&req.method==="GET"){const {data,error}=await db.from("medications").select("id,name,dose,instructions,active,created_at,updated_at").eq("patient_id",patient!.sub).eq("active",true).order("created_at",{ascending:false}).limit(100);if(error)throw error;return json({medications:data||[]},200,origin);}
  if(path==="/v1/logout"&&req.method==="POST"){
   const bearer=(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"");
   if(bearer){const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(bearer));const hash=Array.from(new Uint8Array(digest)).map(x=>x.toString(16).padStart(2,"0")).join("");await db.from("sessions").delete().eq("token_hash",hash);await db.from("doctor_sessions").delete().eq("token_hash",hash);}
   return json({ok:true},200,origin);
  }
  if(path==="/v1/patients/change-password"&&req.method==="POST"){
   const puser=await auth(req,["patient"]);if(!puser)return json({error:"unauthorized"},401,origin);
   const current=String(body.currentPassword||""),next=String(body.newPassword||"");
   if(next.length<12)return json({error:"password_too_short"},400,origin);
   const {data:p}=await db.from("patients").select("password_hash").eq("id",puser.sub).maybeSingle();
   if(!p||!(await bcrypt.compare(current,p.password_hash)))return json({error:"invalid_credentials"},401,origin);
   const {error}=await db.from("patients").update({password_hash:await bcrypt.hash(next,12),updated_at:new Date().toISOString()}).eq("id",puser.sub);
   if(error)throw error;return json({ok:true},200,origin);
  }
  if(path.startsWith("/v1/doctor/appointments/")&&path.endsWith("/status")&&req.method==="PATCH"){
   const duser=await auth(req,["doctor"]);if(!duser)return json({error:"unauthorized"},401,origin);
   const id=path.split("/")[4],status=clean(body.status,20),doctorNote=clean(body.doctorNote,1000);
   if(!["requested","confirmed","rejected","completed","cancelled"].includes(status))return json({error:"invalid_appointment_status"},400,origin);
   const {data:a,error}=await db.from("appointments").update({status,doctor_note:doctorNote,updated_at:new Date().toISOString()}).eq("id",id).select("*").maybeSingle();
   if(error)throw error;if(!a)return json({error:"appointment_not_found"},404,origin);
   await audit(duser.sub,"doctor","appointment.status.update","appointment",a.id,{status});return json({appointment:safeAppointment(a)},200,origin);
  }
  if(path.startsWith("/v1/doctor/medications/")&&path.endsWith("/status")&&req.method==="PATCH"){
   const duser=await auth(req,["doctor"]);if(!duser)return json({error:"unauthorized"},401,origin);
   const id=path.split("/")[4],active=body.active===true;
   const {data:m,error}=await db.from("medications").update({active,updated_at:new Date().toISOString()}).eq("id",id).select("*").maybeSingle();
   if(error)throw error;if(!m)return json({error:"medication_not_found"},404,origin);
   await audit(duser.sub,"doctor","medication.status.update","medication",m.id,{active});return json({medication:m},200,origin);
  }
  return json({error:"not_found"},404,origin);
 }catch(e){console.error("neurocare edge error",e);return json({error:"server_error"},500,origin);}
});
