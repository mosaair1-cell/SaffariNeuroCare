(() => {
  'use strict';
  const root = document.getElementById('app');
  const cfg = window.NEUROCARE_CONFIG || {};
  const API_BASE = String(cfg.API_BASE_URL || '').replace(/\/+$/, '');
  const CLINIC_CODE = String(cfg.CLINIC_CODE || 'SAFFARI');
  const APP_ROLE = cfg.APP_ROLE === 'doctor' ? 'doctor' : 'patient';
  let token = sessionStorage.getItem('snc_token') || '';
  let role = APP_ROLE;
  let currentPatient = null;

  const diseases = [
    ['migraine','میگرن و سردرد'],
    ['ms','ام‌اس'],
    ['epilepsy','صرع'],
    ['parkinson','پارکینسون'],
    ['cognition','اختلالات شناختی'],
    ['unassigned','هنوز مشخص نیست']
  ];
  const statusLabels = {
    pending_review:'در انتظار تأیید پزشک', active:'فعال', rejected:'تأیید نشده',
    requested:'درخواست ثبت شد', confirmed:'نوبت تأیید شد', completed:'انجام شد',
    cancelled:'لغو شد', symptom:'ثبت علائم', pre_visit:'گزارش پیش از ویزیت'
  };
  const errorLabels = {
    unauthorized:'نشست شما پایان یافته است؛ دوباره وارد شوید.',
    forbidden:'این بخش برای حساب شما در دسترس نیست.',
    invalid_credentials:'شماره موبایل/کد ملی یا اطلاعات ورود پزشک درست نیست.',
    invalid_registration_data:'اطلاعات واردشده کامل یا معتبر نیست.',
    invalid_clinic_code:'کد کلینیک معتبر نیست.',
    patient_already_registered:'این شماره موبایل یا کد ملی قبلاً ثبت شده است.',
    awaiting_doctor_approval:'حساب شما ثبت شده و در انتظار تأیید پزشک است.',
    registration_rejected:'ثبت‌نام شما تأیید نشده است؛ با مطب تماس بگیرید.',
    too_many_attempts:'تعداد تلاش‌ها زیاد است؛ کمی بعد دوباره امتحان کنید.',
    appointment_date_in_past:'تاریخ انتخابی در گذشته است.',
    origin_not_allowed:'این نشانی اجازه اتصال به API را ندارد؛ تنظیم CORS باید بررسی شود.',
    password_change_required:'برای ادامه استفاده باید رمز عبور مستقل و امن تعیین کنید.',
    password_min_length_12:'رمز جدید باید حداقل ۱۲ نویسه داشته باشد.',
    password_must_not_be_national_id:'رمز عبور نباید برابر کد ملی باشد.',
    current_password_invalid:'رمز عبور فعلی صحیح نیست.',
    rate_limit_unavailable:'سامانه کنترل تلاش‌های ورود موقتاً در دسترس نیست.'
  };
  const h = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const diseaseTitle = (code) => (diseases.find(d => d[0] === code) || ['','تعیین‌نشده'])[1];
  const statusTitle = (s) => statusLabels[s] || s || 'نامشخص';
  const fmtDate = (value) => {
    if (!value) return '—';
    const val = String(value).slice(0,10);
    return val.replace(/-/g,'/');
  };
  function errorMessage(error) {
    const text = String(error && error.message ? error.message : error || '');
    return errorLabels[text] || text || 'خطای نامشخص';
  }
  async function api(path, method = 'GET', body = undefined) {
    if (!API_BASE) throw new Error('آدرس API در config.js تنظیم نشده است.');
    const headers = { 'Accept':'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (token) headers.Authorization = 'Bearer ' + token;
    let response;
    try {
      response = await fetch(API_BASE + path, {
        method, headers, body: body === undefined ? undefined : JSON.stringify(body),
        cache:'no-store', credentials:'omit'
      });
    } catch (_) {
      throw new Error('اتصال به سرور برقرار نشد. نشانی API، SSL و تنظیمات CORS را بررسی کنید.');
    }
    let data = {};
    try { data = await response.json(); } catch (_) {}
    if (!response.ok) {
      const code = data && data.error ? String(data.error) : 'server_error';
      throw new Error(errorLabels[code] || code);
    }
    return data;
  }
  function messageBox(message, type = 'error') {
    return '<div class="message ' + type + '" role="status">' + h(message) + '</div>';
  }
  function setMessage(form, message, type) {
    let target = form.querySelector('.form-message');
    if (!target) {
      target = document.createElement('div');
      target.className = 'form-message';
      form.appendChild(target);
    }
    target.innerHTML = message ? messageBox(message,type) : '';
  }
  async function logout() {
    try { if (token) await api('/logout','POST',{}); } catch (_) {}
    token = ''; role = APP_ROLE; currentPatient = null;
    sessionStorage.removeItem('snc_token');
    sessionStorage.removeItem('snc_role');
    showLogin(APP_ROLE,'login');
  }
  function headerActions() {
    return '<div class="head-actions"><button class="ghost-button" id="refreshBtn" type="button">به‌روزرسانی</button><button class="secondary" id="logoutBtn" type="button">خروج امن</button></div>';
  }
  function bindCommon() {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', logout);
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) refreshBtn.addEventListener('click', () => loadDashboard());
  }
  function showLogin(initialRole = APP_ROLE, initialMode = 'login') {
    role = APP_ROLE; token = ''; currentPatient = null;
    const mode = initialMode;
    root.innerHTML = `
      <div class="auth-wrap">
        <section class="auth-card">
          <div class="mode-tabs" aria-label="سامانه جاری"><span style="display:block;width:100%;text-align:center;padding:10px 8px;font-weight:800;color:var(--teal-dark)">${APP_ROLE === 'doctor' ? 'دسترسی اختصاصی پزشک' : 'دسترسی اختصاصی بیمار'}</span></div>
          <div id="loginFormArea"></div>
          <div id="globalMessage"></div>
        </section>
        <aside class="auth-aside">
          <div>
            <span class="aside-kicker">${APP_ROLE === 'doctor' ? 'دسترسی حرفه‌ای پزشک' : 'حساب اختصاصی بیمار'}</span>
            <h2>${APP_ROLE === 'doctor' ? 'مدیریت متمرکز مراقبت بیماران.' : 'پیگیری منظم‌تر، همراه شما.'}</h2>
            <p>${APP_ROLE === 'doctor' ? 'مشاهده و تأیید بیماران، بررسی گزارش‌ها، مدیریت نوبت‌ها و ثبت برنامه پیگیری از پنل پزشک.' : 'درخواست نوبت، ثبت گزارش علائم و مشاهده برنامه پیگیری که پزشک برای شما ثبت کرده است.'}</p>
          </div>
          <div class="aside-points">
            <div class="aside-point"><span>✓</span><div><b>پرونده مختص هر بیمار</b><small>اطلاعات از سرور دریافت می‌شود؛ نمونه بیمار ساختگی نمایش داده نمی‌شود.</small></div></div>
            <div class="aside-point"><span>✓</span><div><b>پیگیری نوبت و علائم</b><small>وضعیت نوبت و توصیه‌های ثبت‌شده در حساب کاربر در دسترس است.</small></div></div>
            <div class="aside-point"><span>↗</span><div><b>آموزش معتبر</b><small>دسترسی به مقالات آموزشی سایت رسمی mhsaffari.ir.</small></div></div>
          </div>
        </aside>
      </div>`;
    renderLoginForm(mode);
  }
  function renderLoginForm(mode) {
    const area = document.getElementById('loginFormArea');
    if (!area) return;
    const isDoctor = APP_ROLE === 'doctor';
    const isRegister = !isDoctor && mode === 'register';
    area.innerHTML = `
      <h1>${isDoctor ? 'ورود به پنل پزشک' : (isRegister ? 'ساخت حساب بیمار' : 'خوش آمدید')}</h1>
      <p class="lead">${isDoctor ? 'برای ورود به پنل، مشخصات حساب پزشک را وارد کنید.' : (isRegister ? 'اطلاعات پایه را ثبت کنید تا پزشک بتواند حساب را بررسی و فعال کند.' : 'برای مشاهده نوبت‌ها، گزارش‌ها و برنامه پیگیری وارد حساب خود شوید.')}</p>
      <form id="authForm" novalidate>
        <div class="form-grid">
          ${isDoctor ? `
            <div class="field full"><label for="clinicCode">کد ورود پزشک</label><input id="clinicCode" name="clinicCode" autocomplete="username" value="${h(CLINIC_CODE)}" required></div>
            <div class="field full"><label for="password">رمز عبور پزشک</label><input id="password" type="password" name="password" autocomplete="current-password" required minlength="8"></div>
          ` : `
            ${isRegister ? `
              <div class="field"><label for="firstName">نام</label><input id="firstName" name="firstName" autocomplete="given-name" required maxlength="100"></div>
              <div class="field"><label for="lastName">نام خانوادگی</label><input id="lastName" name="lastName" autocomplete="family-name" required maxlength="100"></div>
              <div class="field full"><label for="diseaseCode">حوزه پیگیری</label><select id="diseaseCode" name="diseaseCode">${diseases.map(d => '<option value="' + h(d[0]) + '">' + h(d[1]) + '</option>').join('')}</select></div>
              <div class="field full"><label for="clinicCode">کد کلینیک</label><input id="clinicCode" name="clinicCode" value="${h(CLINIC_CODE)}" required></div>
            ` : ''}
            <div class="field full"><label for="mobile">شماره موبایل</label><input id="mobile" name="mobile" inputmode="numeric" autocomplete="tel" placeholder="09123456789" pattern="09[0-9]{9}" required maxlength="11"></div>
            ${isRegister ? '<div class="field full"><label for="nationalId">کد ملی (رمز اولیه)</label><input id="nationalId" name="nationalId" inputmode="numeric" autocomplete="off" placeholder="۱۰ رقم" pattern="[0-9]{10}" required maxlength="10"></div>' : '<div class="field full"><label for="patientPassword">رمز عبور</label><input id="patientPassword" name="password" type="password" autocomplete="current-password" required minlength="10" placeholder="رمز عبور مستقل یا کد ملی اولیه"></div>'}
          `}
        </div>
        ${!isDoctor ? '<p class="hint">نسخه فعلی برای سازگاری با اپ آزمایشی از کد ملی به‌عنوان اعتبار اولیه ورود استفاده می‌کند. برای استفاده با اطلاعات واقعی بیمار، احراز هویت مستقل و امن باید قبل از انتشار نهایی فعال شود.</p>' : ''}
        <button class="primary full-button" type="submit">${isDoctor ? 'ورود به پنل پزشک' : (isRegister ? 'ثبت‌نام و ارسال برای بررسی' : 'ورود به حساب')}</button>
        <div class="form-message"></div>
      </form>
      <div class="auth-footer">
        ${isDoctor ? '<span>دسترسی فقط برای پزشک مجاز است.</span>' : (isRegister ? '<span>قبلاً حساب ساخته‌اید؟</span><button class="link-button" type="button" id="modeLogin">ورود به حساب</button>' : '<span>حساب ندارید؟</span><button class="link-button" type="button" id="modeRegister">ثبت‌نام بیمار</button>')}
      </div>`;
    const form = document.getElementById('authForm');
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const submit = form.querySelector('button[type="submit"]');
      submit.disabled = true;
      submit.textContent = 'در حال بررسی…';
      const fd = new FormData(form);
      try {
        let data;
        if (isDoctor) {
          data = await api('/doctor/login','POST',{clinicCode:fd.get('clinicCode'),password:fd.get('password')});
        } else if (isRegister) {
          data = await api('/patients/register','POST',{
            firstName:fd.get('firstName'),lastName:fd.get('lastName'),
            mobile:fd.get('mobile'),nationalId:fd.get('nationalId'),
            diseaseCode:fd.get('diseaseCode'),clinicCode:fd.get('clinicCode')
          });
        } else {
          data = await api('/patients/login','POST',{mobile:fd.get('mobile'),password:fd.get('password')});
        }
        token = String(data.token || '');
        role = APP_ROLE;
        if (!token) throw new Error('سرور توکن ورود را برنگرداند.');
        sessionStorage.setItem('snc_token',token);
        sessionStorage.setItem('snc_role',role);
        await loadDashboard();
      } catch (error) {
        setMessage(form,errorMessage(error),'error');
      } finally {
        if (document.body.contains(submit)) {
          submit.disabled = false;
          submit.textContent = isDoctor ? 'ورود به پنل پزشک' : (isRegister ? 'ثبت‌نام و ارسال برای بررسی' : 'ورود به حساب');
        }
      }
    });
    const loginBtn = document.getElementById('modeLogin');
    if (loginBtn) loginBtn.addEventListener('click',() => renderLoginForm('login'));
    const registerBtn = document.getElementById('modeRegister');
    if (registerBtn) registerBtn.addEventListener('click',() => renderLoginForm('register'));
  }
  async function loadDashboard() {
    if (!token) return showLogin(APP_ROLE,'login');
    if (APP_ROLE === 'doctor') return loadDoctorDashboard();
    return loadPatientDashboard();
  }
  function metric(label,value,sub='') {
    return '<div class="metric"><span class="label">' + h(label) + '</span><strong>' + h(value) + '</strong>' + (sub ? '<small>' + h(sub) + '</small>' : '') + '</div>';
  }
  function appointmentCard(a) {
    return `<div class="appointment-card">
      <div class="appointment-top"><div><div class="patient-name">${h(fmtDate(a.preferredDate))} · ${h(String(a.preferredTime || '').slice(0,5))}</div><div class="subline">${h(a.reason || 'بدون توضیح')}</div></div><span class="badge ${h(a.status)}">${h(statusTitle(a.status))}</span></div>
      ${a.doctorNote ? '<div class="subline" style="margin-top:9px">پیام مطب: ' + h(a.doctorNote) + '</div>' : ''}
    </div>`;
  }
  function noteCard(n) {
    return '<div class="row-item"><div><strong>' + h(n.doctorLabel || 'پزشک معالج') + '</strong><p>' + h(n.noteText || '') + '</p></div><small class="subline">' + h(fmtDate(n.createdAt)) + '</small></div>';
  }
  function simpleCard(title, textValue, dateValue='') {
    return '<div class="care-card"><strong>' + h(title) + '</strong>' + (dateValue ? '<div class="subline">' + h(fmtDate(dateValue)) + '</div>' : '') + '<p style="white-space:pre-wrap;line-height:1.9;margin:9px 0 0">' + h(textValue) + '</p></div>';
  }
  function renderPasswordChange() {
    root.innerHTML = `
      <div class="auth-wrap">
        <section class="auth-card">
          <h1>تعیین رمز عبور امن</h1>
          <p class="lead">برای حفاظت از اطلاعات پزشکی، رمز اولیه (کد ملی) را با رمز اختصاصی حداقل ۱۲ نویسه‌ای جایگزین کنید. تا انجام این مرحله، بخش‌های دیگر حساب قفل می‌مانند.</p>
          <form id="passwordChangeForm">
            <div class="form-grid">
              <div class="field full"><label for="currentPassword">رمز فعلی (کد ملی اولیه)</label><input id="currentPassword" name="currentPassword" type="password" autocomplete="current-password" required></div>
              <div class="field full"><label for="newPassword">رمز جدید</label><input id="newPassword" name="newPassword" type="password" autocomplete="new-password" minlength="12" required></div>
              <div class="field full"><label for="confirmPassword">تکرار رمز جدید</label><input id="confirmPassword" name="confirmPassword" type="password" autocomplete="new-password" minlength="12" required></div>
            </div>
            <p class="hint">از رمز عبور منحصربه‌فرد استفاده کنید و آن را برای کسی ارسال نکنید. این رمز در مرورگر ذخیره نمی‌شود.</p>
            <button class="primary full-button" type="submit">ذخیره رمز امن</button><div class="form-message"></div>
          </form>
          <div class="auth-footer"><button id="logoutBtn" type="button" class="link-button">خروج از حساب</button><span>پس از تغییر رمز، سایر نشست‌ها لغو می‌شوند.</span></div>
        </section>
        <aside class="auth-aside">
          <span class="aside-kicker">حفاظت از داده‌های پزشکی</span>
          <h2>امنیت حساب شما مهم است.</h2>
          <p>رمز عبور را مستقل از کد ملی انتخاب کنید؛ از رمزهای کوتاه یا قابل حدس استفاده نکنید.</p>
        </aside>
      </div>`;
    document.getElementById('logoutBtn')?.addEventListener('click', logout);
    const form = document.getElementById('passwordChangeForm');
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const f = new FormData(form);
      const currentPassword = String(f.get('currentPassword') || '');
      const newPassword = String(f.get('newPassword') || '');
      const confirmPassword = String(f.get('confirmPassword') || '');
      if (newPassword.length < 12) return setMessage(form,'رمز جدید باید حداقل ۱۲ نویسه داشته باشد.','error');
      if (newPassword !== confirmPassword) return setMessage(form,'تکرار رمز با رمز جدید یکسان نیست.','error');
      if (newPassword === currentPassword) return setMessage(form,'رمز جدید باید با رمز فعلی تفاوت داشته باشد.','error');
      const submit = form.querySelector('button[type="submit"]');
      submit.disabled = true;
      try {
        const result = await api('/patients/change-password','POST',{currentPassword,newPassword});
        token = String(result.token || '');
        if (!token) throw new Error('سرور نشست جدید برنگرداند.');
        sessionStorage.setItem('snc_token',token);
        sessionStorage.setItem('snc_role',APP_ROLE);
        await loadPatientDashboard();
      } catch (error) {
        setMessage(form,errorMessage(error),'error');
        submit.disabled = false;
      }
    });
  }

  async function loadPatientDashboard() {
    root.innerHTML = '<section class="loading-card"><div class="spinner"></div><p>در حال دریافت اطلاعات حساب…</p></section>';
    try {
      const profile = (await api('/patients/me')).patient;
      currentPatient = profile;
      if (profile.requiresPasswordChange) { renderPasswordChange(); return; }
      const active = profile.status === 'active';
      let appointments = [], reports = [], notes = [], plans = [], medications = [];
      if (active) {
        const values = await Promise.allSettled([
          api('/patients/appointments'), api('/patients/reports'), api('/patients/notes'),
          api('/patients/treatment-plan'), api('/patients/medications')
        ]);
        appointments = values[0].status === 'fulfilled' ? values[0].value.appointments || [] : [];
        reports = values[1].status === 'fulfilled' ? values[1].value.reports || [] : [];
        notes = values[2].status === 'fulfilled' ? values[2].value.notes || [] : [];
        plans = values[3].status === 'fulfilled' ? values[3].value.plans || [] : [];
        medications = values[4].status === 'fulfilled' ? values[4].value.medications || [] : [];
      }
      root.innerHTML = `
        <div class="dash-head">
          <div><h1>سلام ${h(profile.firstName || 'بیمار')} عزیز</h1><p>پنل اختصاصی بیمار · ${h(diseaseTitle(profile.diseaseCode))}</p></div>
          ${headerActions()}
        </div>
        ${!active ? '<div class="notice-card warning"><strong>' + h(statusTitle(profile.status)) + '</strong><br>پس از بررسی حساب توسط پزشک، امکانات ثبت نوبت و پیگیری فعال می‌شود. تا آن زمان اطلاعات پزشکی دیگری وارد نکنید.</div>' : ''}
        <div class="metrics">
          ${metric('وضعیت حساب',active ? 'فعال' : (profile.status === 'rejected' ? 'نیازمند تماس' : 'در انتظار'),statusTitle(profile.status))}
          ${metric('درخواست نوبت',String(appointments.length),'نوبت‌های ثبت‌شده')}
          ${metric('گزارش‌های من',String(reports.length),'گزارش علائم و پیش‌ویزیت')}
          ${metric('برنامه پیگیری',String(plans.length),'برنامه‌های فعال')}
        </div>
        ${active ? `
        <div class="content-grid">
          <div class="stack">
            <section class="panel">
              <div class="panel-heading"><h2>درخواست نوبت</h2><small>نوبت پس از تأیید مطب قطعی است</small></div>
              <form id="appointmentForm">
                <div class="form-grid">
                  <div class="field"><label for="preferredDate">تاریخ پیشنهادی</label><input id="preferredDate" name="preferredDate" type="date" min="${new Date().toISOString().slice(0,10)}" required></div>
                  <div class="field"><label for="preferredTime">ساعت پیشنهادی</label><input id="preferredTime" name="preferredTime" type="time" required></div>
                  <div class="field full"><label for="reason">علت مراجعه</label><textarea id="reason" name="reason" maxlength="1000" required placeholder="در چند جمله علت مراجعه را بنویسید"></textarea></div>
                </div>
                <button class="primary full-button" type="submit">ارسال درخواست نوبت</button><div class="form-message"></div>
              </form>
            </section>
            <section class="panel">
              <div class="panel-heading"><h2>نوبت‌های من</h2><small>${appointments.length} مورد</small></div>
              <div class="list">${appointments.length ? appointments.map(appointmentCard).join('') : '<div class="empty-card">هنوز درخواست نوبتی ثبت نشده است.</div>'}</div>
            </section>
            <section class="panel">
              <div class="panel-heading"><h2>گزارش علائم / پیش از ویزیت</h2><small>گزارش برای بررسی پزشک</small></div>
              <form id="reportForm">
                <div class="field full"><label>علائم اخیر</label><div class="chips">
                  <label class="chip"><input type="checkbox" name="symptoms" value="headache"> سردرد</label>
                  <label class="chip"><input type="checkbox" name="symptoms" value="fatigue"> خستگی</label>
                  <label class="chip"><input type="checkbox" name="symptoms" value="numbness"> گزگز / بی‌حسی</label>
                  <label class="chip"><input type="checkbox" name="symptoms" value="vision"> مشکل بینایی</label>
                  <label class="chip"><input type="checkbox" name="symptoms" value="balance"> اختلال تعادل</label>
                  <label class="chip"><input type="checkbox" name="symptoms" value="sleep"> اختلال خواب</label>
                </div></div>
                <div class="form-grid" style="margin-top:14px">
                  <div class="field"><label for="severity">شدت کلی (۱ تا ۱۰)</label><input id="severity" type="number" name="severity" min="1" max="10" value="3"></div>
                  <div class="field"><label for="occurredOn">تاریخ گزارش</label><input id="occurredOn" type="date" name="occurredOn" value="${new Date().toISOString().slice(0,10)}"></div>
                  <div class="field full"><label for="reportNotes">توضیحات</label><textarea id="reportNotes" name="notes" maxlength="4000" placeholder="زمان شروع، مدت، تغییر علائم و نکات مهم را بنویسید"></textarea></div>
                </div>
                <button class="primary full-button" type="submit">ثبت گزارش برای پزشک</button><div class="form-message"></div>
              </form>
            </section>
            <section class="panel">
              <div class="panel-heading"><h2>گزارش‌های قبلی</h2><small>${reports.length} مورد</small></div>
              <div class="row-list">${reports.length ? reports.map(r => '<div class="row-item"><div><strong>' + h(statusTitle(r.report_type)) + ' · شدت ' + h(r.severity || '—') + '</strong><p>' + h([...(Array.isArray(r.symptoms) ? r.symptoms : []),r.notes].filter(Boolean).join('، ')) + '</p></div><small class="subline">' + h(fmtDate(r.submitted_at)) + '</small></div>').join('') : '<div class="empty-card">هنوز گزارشی ثبت نشده است.</div>'}</div>
            </section>
          </div>
          <div class="stack">
            <section class="panel">
              <div class="panel-heading"><h2>برنامه پیگیری پزشک</h2><small>اطلاعات ثبت‌شده</small></div>
              <div class="list">${plans.length ? plans.map(p => simpleCard(p.title,p.instructions,p.follow_up_date)).join('') : '<div class="empty-card">هنوز برنامه پیگیری‌ای ثبت نشده است.</div>'}</div>
            </section>
            <section class="panel">
              <div class="panel-heading"><h2>داروهای ثبت‌شده</h2><small>طبق دستور پزشک</small></div>
              <div class="list">${medications.length ? medications.map(m => simpleCard(m.name, (m.dose || '') + (m.instructions ? ' · ' + m.instructions : ''),m.created_at)).join('') : '<div class="empty-card">دارویی برای نمایش ثبت نشده است.</div>'}</div>
            </section>
            <section class="panel">
              <div class="panel-heading"><h2>پیام‌ها و یادداشت‌های پزشک</h2><small>قابل مشاهده برای شما</small></div>
              <div class="row-list">${notes.length ? notes.map(noteCard).join('') : '<div class="empty-card">هنوز یادداشتی برای نمایش وجود ندارد.</div>'}</div>
            </section>
            <section class="panel">
              <div class="panel-heading"><h2>مطالعه بیشتر</h2><small>سایت رسمی</small></div>
              <div class="row-list">
                <div class="row-item"><div><strong>راهنمای جامع ام‌اس</strong><p>آشنایی با علائم و مسیر پیگیری بیماری</p></div><a href="https://mhsaffari.ir/articles/ms/multiple-sclerosis-ms.html" target="_blank" rel="noopener">مطالعه ↗</a></div>
                <div class="row-item"><div><strong>درمان میگرن</strong><p>اطلاعات آموزشی درباره سردرد و درمان</p></div><a href="https://mhsaffari.ir/articles/migraine/migraine-treatment-comprehensive-saffari.html" target="_blank" rel="noopener">مطالعه ↗</a></div>
                <div class="row-item"><div><strong>مقالات مغز و اعصاب</strong><p>محتوای آموزشی منتشرشده در سایت</p></div><a href="https://mhsaffari.ir/" target="_blank" rel="noopener">مشاهده ↗</a></div>
              </div>
            </section>
          </div>
        </div>` : ''}
      `;
      bindCommon();
      if (active) bindPatientForms();
    } catch (error) {
      root.innerHTML = '<section class="panel"><h2>دریافت اطلاعات ناموفق بود</h2>' + messageBox(errorMessage(error),'error') + '<div class="card-actions"><button class="secondary" id="retryBtn">تلاش دوباره</button><button class="ghost-button" id="logoutBtn">خروج امن</button></div></section>';
      document.getElementById('retryBtn')?.addEventListener('click',loadDashboard);
      document.getElementById('logoutBtn')?.addEventListener('click',logout);
    }
  }
  function bindPatientForms() {
    const appointmentForm = document.getElementById('appointmentForm');
    if (appointmentForm) appointmentForm.addEventListener('submit',async (event) => {
      event.preventDefault();
      const submit = appointmentForm.querySelector('button[type="submit"]');
      submit.disabled = true;
      const f = new FormData(appointmentForm);
      try {
        await api('/patients/appointments','POST',{
          preferredDate:f.get('preferredDate'),preferredTime:f.get('preferredTime'),reason:f.get('reason')
        });
        setMessage(appointmentForm,'درخواست ثبت شد؛ تا تأیید مطب، نوبت قطعی نیست.','ok');
        await loadPatientDashboard();
      } catch (e) { setMessage(appointmentForm,errorMessage(e),'error'); submit.disabled = false; }
    });
    const reportForm = document.getElementById('reportForm');
    if (reportForm) reportForm.addEventListener('submit',async (event) => {
      event.preventDefault();
      const submit = reportForm.querySelector('button[type="submit"]');
      submit.disabled = true;
      const f = new FormData(reportForm);
      try {
        await api('/patients/reports','POST',{
          reportType:'pre_visit',severity:f.get('severity'),occurredOn:f.get('occurredOn'),
          symptoms:f.getAll('symptoms'),notes:f.get('notes')
        });
        setMessage(reportForm,'گزارش برای بررسی پزشک ثبت شد.','ok');
        await loadPatientDashboard();
      } catch (e) { setMessage(reportForm,errorMessage(e),'error'); submit.disabled = false; }
    });
  }
  function renderPatientRow(p) {
    const status = p.status || 'pending_review';
    return `<div class="patient-card">
      <div class="patient-top"><div><div class="patient-name">${h((p.firstName || '') + ' ' + (p.lastName || ''))}</div><div class="subline">${h(p.mobile || '')} · ${h(p.nationalId || '')}<br>${h(diseaseTitle(p.diseaseCode))}</div></div><span class="badge ${status === 'active' ? 'active' : (status === 'rejected' ? 'rejected' : 'pending')}">${h(statusTitle(status))}</span></div>
      <div class="card-actions">
        <button class="secondary" data-action="detail" data-id="${h(p.id)}">پرونده</button>
        ${status !== 'active' ? '<button class="primary" data-action="approve" data-id="' + h(p.id) + '">تأیید حساب</button>' : ''}
        ${status !== 'rejected' ? '<button class="danger-button" data-action="reject" data-id="' + h(p.id) + '">عدم تأیید</button>' : ''}
      </div>
    </div>`;
  }
  function renderDoctorAppointment(a) {
    return `<div class="appointment-card">
      <div class="appointment-top"><div><div class="patient-name">${h(a.patientName || 'بیمار')} · ${h(fmtDate(a.preferredDate))} · ${h(String(a.preferredTime || '').slice(0,5))}</div><div class="subline">${h(a.patientMobile || '')}</div><p style="line-height:1.9;white-space:pre-wrap;margin:9px 0 0">${h(a.reason || '')}</p></div><span class="badge ${h(a.status)}">${h(statusTitle(a.status))}</span></div>
      <div class="card-actions">
        ${a.status === 'requested' ? '<button class="primary" data-appt-status="confirmed" data-id="' + h(a.id) + '">تأیید نوبت</button><button class="danger-button" data-appt-status="rejected" data-id="' + h(a.id) + '">رد درخواست</button>' : ''}
        ${a.status === 'confirmed' ? '<button class="secondary" data-appt-status="completed" data-id="' + h(a.id) + '">ثبت انجام ویزیت</button><button class="ghost-button" data-appt-status="cancelled" data-id="' + h(a.id) + '">لغو نوبت</button>' : ''}
      </div>
    </div>`;
  }
  async function loadDoctorDashboard() {
    root.innerHTML = '<section class="loading-card"><div class="spinner"></div><p>در حال دریافت اطلاعات سرور…</p></section>';
    try {
      const values = await Promise.all([api('/doctor/patients'),api('/doctor/appointments')]);
      const patients = values[0].patients || [];
      const appointments = values[1].appointments || [];
      const pending = patients.filter(p => p.status === 'pending_review').length;
      const requested = appointments.filter(a => a.status === 'requested').length;
      root.innerHTML = `
        <div class="dash-head"><div><h1>پنل پزشک</h1><p>مدیریت بیماران، درخواست‌های نوبت و برنامه پیگیری</p></div>${headerActions()}</div>
        <div class="metrics">
          ${metric('کل بیماران',String(patients.length),'دریافت‌شده از سرور')}
          ${metric('در انتظار تأیید',String(pending),'ثبت‌نام جدید')}
          ${metric('درخواست نوبت',String(requested),'نیازمند تصمیم مطب')}
          ${metric('کل نوبت‌ها',String(appointments.length),'درخواست و نوبت‌های ثبت‌شده')}
        </div>
        <div class="content-grid">
          <section class="panel">
            <div class="panel-heading"><h2>بیماران</h2><small>${patients.length} مورد</small></div>
            <div class="list" id="patientsList">${patients.length ? patients.map(renderPatientRow).join('') : '<div class="empty-card">هنوز بیماری در سرور ثبت نشده است. پس از ثبت‌نام بیمار، این فهرست به‌روزرسانی می‌شود.</div>'}</div>
          </section>
          <div class="stack">
            <section class="panel">
              <div class="panel-heading"><h2>درخواست‌های نوبت</h2><small>${appointments.length} مورد</small></div>
              <div class="list" id="appointmentsList">${appointments.length ? appointments.map(renderDoctorAppointment).join('') : '<div class="empty-card">هنوز درخواستی برای نوبت ثبت نشده است.</div>'}</div>
            </section>
            <section class="panel">
              <div class="panel-heading"><h2>نکته مهم</h2></div>
              <p class="lead" style="margin:0;font-size:14px">این پنل فقط اطلاعات ذخیره‌شده در سرور را نمایش می‌دهد. تصمیم‌گیری درباره تشخیص یا تغییر درمان باید توسط پزشک انجام شود.</p>
            </section>
          </div>
        </div>`;
      bindCommon();
      root.querySelectorAll('[data-action]').forEach(btn => btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const action = btn.dataset.action;
        try {
          if (action === 'detail') return loadDoctorPatient(id);
          const status = action === 'approve' ? 'active' : 'rejected';
          if (!confirm(status === 'active' ? 'حساب این بیمار تأیید شود؟' : 'ثبت‌نام این بیمار تأیید نشود؟')) return;
          await api('/doctor/patients/' + encodeURIComponent(id) + '/status','PATCH',{status});
          await loadDoctorDashboard();
        } catch (e) { alert(errorMessage(e)); }
      }));
      root.querySelectorAll('[data-appt-status]').forEach(btn => btn.addEventListener('click',async () => {
        try {
          let doctorNote = '';
          if (btn.dataset.apptStatus === 'rejected') doctorNote = prompt('پیام کوتاه برای بیمار (اختیاری):','') || '';
          await api('/doctor/appointments/' + encodeURIComponent(btn.dataset.id) + '/status','PATCH',{status:btn.dataset.apptStatus,doctorNote});
          await loadDoctorDashboard();
        } catch (e) { alert(errorMessage(e)); }
      }));
    } catch (error) {
      root.innerHTML = '<section class="panel"><h2>اتصال پنل پزشک برقرار نشد</h2>' + messageBox(errorMessage(error),'error') + '<div class="card-actions"><button class="secondary" id="retryBtn">تلاش دوباره</button><button class="ghost-button" id="logoutBtn">خروج امن</button></div></section>';
      document.getElementById('retryBtn')?.addEventListener('click',loadDashboard);
      document.getElementById('logoutBtn')?.addEventListener('click',logout);
    }
  }
  async function loadDoctorPatient(id) {
    root.innerHTML = '<section class="loading-card"><div class="spinner"></div><p>در حال دریافت پرونده…</p></section>';
    try {
      const values = await Promise.all([
        api('/doctor/patients/' + encodeURIComponent(id)),
        api('/doctor/patients/' + encodeURIComponent(id) + '/reports'),
        api('/doctor/patients/' + encodeURIComponent(id) + '/notes')
      ]);
      const p = values[0].patient;
      const reports = values[1].reports || [];
      const notes = values[2].notes || [];
      currentPatient = p;
      root.innerHTML = `
        <div class="dash-head"><div><h1>پرونده بیمار</h1><p>${h((p.firstName || '') + ' ' + (p.lastName || ''))} · ${h(diseaseTitle(p.diseaseCode))}</p></div><div class="head-actions"><button class="ghost-button" id="backBtn">بازگشت</button><button class="secondary" id="logoutBtn">خروج امن</button></div></div>
        <div class="metrics">${metric('وضعیت حساب',statusTitle(p.status))}${metric('شماره تماس',p.mobile || '—')}${metric('کد ملی',p.nationalId || 'پنهان')}${metric('تاریخ ثبت',fmtDate(p.createdAt))}</div>
        <div class="content-grid">
          <div class="stack">
            <section class="panel"><div class="panel-heading"><h2>گزارش‌های بیمار</h2><small>${reports.length} مورد</small></div>
              <div class="row-list">${reports.length ? reports.map(r => '<div class="row-item"><div><strong>' + h(statusTitle(r.report_type)) + ' · شدت ' + h(r.severity || '—') + '</strong><p>' + h([...(Array.isArray(r.symptoms)?r.symptoms:[]),r.notes].filter(Boolean).join('، ')) + '</p></div><small class="subline">' + h(fmtDate(r.submitted_at)) + '</small></div>').join('') : '<div class="empty-card">گزارشی ثبت نشده است.</div>'}</div>
            </section>
            <section class="panel"><div class="panel-heading"><h2>یادداشت‌های بالینی</h2><small>${notes.length} مورد</small></div>
              <div class="row-list">${notes.length ? notes.map(n => '<div class="row-item"><div><strong>' + h(n.visible_to_patient ? 'قابل مشاهده برای بیمار' : 'یادداشت داخلی') + '</strong><p>' + h(n.note_text) + '</p></div><small class="subline">' + h(fmtDate(n.created_at)) + '</small></div>').join('') : '<div class="empty-card">یادداشتی ثبت نشده است.</div>'}</div>
              <form id="noteForm" class="form-section"><h3>ثبت یادداشت جدید</h3><div class="field"><label for="noteText">متن یادداشت</label><textarea id="noteText" name="noteText" required minlength="3" maxlength="5000"></textarea></div><label class="chip" style="margin-top:10px"><input type="checkbox" name="visibleToPatient"> این یادداشت در پنل بیمار نمایش داده شود</label><button class="primary full-button" type="submit">ذخیره یادداشت</button><div class="form-message"></div></form>
            </section>
          </div>
          <div class="stack">
            <section class="panel"><div class="panel-heading"><h2>ثبت برنامه پیگیری</h2></div>
              <form id="planForm"><div class="field"><label for="planTitle">عنوان</label><input id="planTitle" name="title" required maxlength="200"></div><div class="field" style="margin-top:12px"><label for="planInstructions">توصیه و برنامه ثبت‌شده توسط پزشک</label><textarea id="planInstructions" name="instructions" required maxlength="4000"></textarea></div><div class="field" style="margin-top:12px"><label for="followUpDate">تاریخ پیگیری (اختیاری)</label><input id="followUpDate" name="followUpDate" type="date"></div><button class="primary full-button" type="submit">ذخیره برنامه پیگیری</button><div class="form-message"></div></form>
            </section>
            <section class="panel"><div class="panel-heading"><h2>ثبت دارو</h2><small>طبق تصمیم پزشک</small></div>
              <form id="medForm"><div class="field"><label for="medName">نام دارو</label><input id="medName" name="name" required maxlength="200"></div><div class="field" style="margin-top:12px"><label for="medDose">دوز / مقدار</label><input id="medDose" name="dose" required maxlength="200"></div><div class="field" style="margin-top:12px"><label for="medInstructions">نحوه مصرف و توضیحات</label><textarea id="medInstructions" name="instructions" maxlength="1000"></textarea></div><button class="primary full-button" type="submit">ثبت دارو</button><div class="form-message"></div></form>
            </section>
          </div>
        </div>`;
      document.getElementById('backBtn')?.addEventListener('click',loadDoctorDashboard);
      document.getElementById('logoutBtn')?.addEventListener('click',logout);
      bindDoctorPatientForms(id);
    } catch (error) {
      root.innerHTML = '<section class="panel"><h2>باز کردن پرونده ناموفق بود</h2>' + messageBox(errorMessage(error),'error') + '<button class="secondary" id="backBtn">بازگشت به بیماران</button></section>';
      document.getElementById('backBtn')?.addEventListener('click',loadDoctorDashboard);
    }
  }
  function bindDoctorPatientForms(id) {
    const noteForm = document.getElementById('noteForm');
    if (noteForm) noteForm.addEventListener('submit',async e => {
      e.preventDefault(); const btn = noteForm.querySelector('button[type="submit"]'); btn.disabled = true;
      const f = new FormData(noteForm);
      try {
        await api('/doctor/patients/' + encodeURIComponent(id) + '/notes','POST',{
          noteText:f.get('noteText'),visibleToPatient:f.get('visibleToPatient') === 'on'
        });
        await loadDoctorPatient(id);
      } catch (error) { setMessage(noteForm,errorMessage(error),'error'); btn.disabled = false; }
    });
    const planForm = document.getElementById('planForm');
    if (planForm) planForm.addEventListener('submit',async e => {
      e.preventDefault(); const btn = planForm.querySelector('button[type="submit"]'); btn.disabled = true;
      const f = new FormData(planForm);
      try {
        await api('/doctor/patients/' + encodeURIComponent(id) + '/treatment-plan','POST',{
          title:f.get('title'),instructions:f.get('instructions'),followUpDate:f.get('followUpDate')
        });
        alert('برنامه پیگیری ذخیره شد و در پنل بیمار نمایش داده می‌شود.');
        await loadDoctorPatient(id);
      } catch (error) { setMessage(planForm,errorMessage(error),'error'); btn.disabled = false; }
    });
    const medForm = document.getElementById('medForm');
    if (medForm) medForm.addEventListener('submit',async e => {
      e.preventDefault(); const btn = medForm.querySelector('button[type="submit"]'); btn.disabled = true;
      const f = new FormData(medForm);
      try {
        await api('/doctor/patients/' + encodeURIComponent(id) + '/medications','POST',{
          name:f.get('name'),dose:f.get('dose'),instructions:f.get('instructions')
        });
        alert('دارو ثبت شد و در پنل بیمار نمایش داده می‌شود.');
        medForm.reset(); btn.disabled = false;
      } catch (error) { setMessage(medForm,errorMessage(error),'error'); btn.disabled = false; }
    });
  }
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
  }
  if (token && role) loadDashboard(); else showLogin('patient','login');
})();