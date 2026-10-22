(() => {
  'use strict';
  const root = document.getElementById('app');
  const cfg = window.NEUROCARE_CONFIG || {};
  const API_BASE = String(cfg.API_BASE_URL || '').replace(/\/+$/, '');
  const CLINIC_CODE = String(cfg.CLINIC_CODE || 'SAFFARI');
  const APP_ROLE = cfg.APP_ROLE === 'doctor' ? 'doctor' : 'patient';
  document.documentElement.classList.add(APP_ROLE === 'doctor' ? 'role-doctor' : 'role-patient');
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', APP_ROLE === 'doctor' ? '#4c1d95' : '#0f766e');
  let token = sessionStorage.getItem('snc_token') || '';
  let role = APP_ROLE;
  let currentPatient = null;

  const diseases = [
    ['migraine','میگرن و سردرد'],
    ['ms','ام‌اس'],
    ['epilepsy','صرع'],
    ['parkinson','پارکینسون'],
    ['cognition','اختلالات شناختی'],
    ['low_back_pain','کمردرد'],
    ['stroke','سکته مغزی'],
    ['vertigo','سرگیجه و اختلال تعادل'],
    ['myasthenia_gravis','میاستنی گراویس'],
    ['neuropathy','نوروپاتی'],
    ['als','ALS (اسکلروز جانبی آمیوتروفیک)'],
    ['myopathy','میوپاتی'],
    ['other','سایر'],
    ['unassigned','هنوز مشخص نیست']
  ];
  const statusLabels = {
    pending_review:'در انتظار تأیید پزشک', active:'فعال', rejected:'تأیید نشده',
    requested:'درخواست ثبت شد', confirmed:'نوبت تأیید شد', completed:'ویزیت شد',
    cancelled:'لغو شد', symptom:'ثبت علائم', pre_visit:'گزارش پیش از ویزیت', initial_visit:'شرح حال و ویزیت اول'
  };
  const errorLabels = {
    unauthorized:'نشست شما پایان یافته است؛ دوباره وارد شوید.',
    forbidden:'این بخش برای حساب شما در دسترس نیست.',
    invalid_credentials:'کد ملی یا رمز عبور واردشده صحیح نیست.',
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
    rate_limit_unavailable:'سامانه کنترل تلاش‌های ورود موقتاً در دسترس نیست.',
    invalid_captcha:'پاسخ کپچا درست نیست یا زمان آن تمام شده؛ سؤال تازه را حل کنید.',
    invalid_patient_password:'رمز بیمار باید ۸ تا ۱۲ نویسه انگلیسی و شامل حرف، عدد و نماد باشد.',
    confirmation_required:'برای تغییر حوزه، باید هشدار حذف سوابق را تأیید کنید.',
    invalid_disease_code:'حوزه پیگیری انتخاب‌شده معتبر نیست.',
    report_notes_too_long:'شرح حال و توضیحات گزارش حداکثر ۲۴۰۰ نویسه می‌تواند باشد.',
    slot_unavailable:'این زمان همین حالا رزرو شده یا دیگر قابل انتخاب نیست؛ زمان دیگری را انتخاب کنید.',
    invalid_availability:'روز یا ساعت کاری واردشده معتبر نیست.',
    invalid_leave_range:'بازه مرخصی یا نوع نوبت واردشده معتبر نیست.',
    availability_not_found:'بازه زمانی موردنظر پیدا نشد.',
    score_not_applicable:'ثبت EDSS فقط برای پرونده بیماران ام‌اس فعال است.',
    invalid_edss:'نمره EDSS، تاریخ یا توضیحات واردشده معتبر نیست.'
  };
  const h = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const normalizeDigits = (value) => String(value == null ? '' : value)
    .replace(/[۰-۹]/g, c => String(c.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, c => String(c.charCodeAt(0) - 0x0660));
  const diseaseTitle = (code, customLabel) => code === 'other' && String(customLabel || '').trim() ? String(customLabel).trim() : (diseases.find(d => d[0] === code) || ['','تعیین‌نشده'])[1];
  const statusTitle = (s) => statusLabels[s] || s || 'نامشخص';
  const fmtDate = (value) => {
    if (!value) return '—';
    const val = String(value).slice(0,10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(val)) return val.replace(/-/g,'/');
    return jalaliFullDateFormatter.format(dateFromISO(val));
  };
  const jalaliPartsFormatter = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
    year:'numeric', month:'numeric', day:'numeric'
  });
  const jalaliMonthFormatter = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
    year:'numeric', month:'long'
  });
  const jalaliDayNumberFormatter = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
    day:'numeric'
  });
  const jalaliFullDateFormatter = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
    weekday:'long', year:'numeric', month:'long', day:'numeric'
  });
  function dateFromISO(value) {
    const parts = String(value || '').slice(0,10).split('-').map(Number);
    return new Date(parts[0], (parts[1] || 1) - 1, parts[2] || 1, 12, 0, 0, 0);
  }
  function isoFromDate(date) {
    return [date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');
  }
  function shiftDate(date, amount) {
    const next = new Date(date.getTime());
    next.setDate(next.getDate() + amount);
    return next;
  }
  function jalaliDateParts(date) {
    const parts = jalaliPartsFormatter.formatToParts(date);
    const partNumber = (name) => {
      const value = parts.find(part => part.type === name)?.value || '';
      return Number(normalizeDigits(value).replace(/[^0-9]/g,''));
    };
    const year = partNumber('year');
    const month = partNumber('month');
    const day = partNumber('day');
    return {year,month,day,key:String(year) + '-' + String(month).padStart(2,'0')};
  }
  function jalaliMonthStart(date) {
    let start=new Date(date.getFullYear(),date.getMonth(),date.getDate(),12,0,0,0),p=jalaliDateParts(start);
    for(let i=0;i<32;i++){const prev=shiftDate(start,-1),q=jalaliDateParts(prev);if(q.year!==p.year||q.month!==p.month)break;start=prev;}return start;
  }
  function attachJalaliDatePickers(scope) {
    if(!scope||!scope.querySelectorAll)return;
    scope.querySelectorAll('input[type="date"]').forEach(original=>{
      if(original.dataset.jalaliPickerReady==='true')return;original.dataset.jalaliPickerReady='true';
      const oldId=original.id||('jalaliDate'+Math.random().toString(36).slice(2,8)),value=original.value,isRequired=original.required,min=original.min,max=original.max;
      const label=scope.querySelector('label[for="'+oldId+'"]')?.textContent?.trim()||'انتخاب تاریخ';
      const display=document.createElement('input');display.type='text';display.id=oldId;display.readOnly=true;display.autocomplete='off';display.className=(original.className+' jalali-date-display').trim();display.placeholder='انتخاب تاریخ هجری شمسی';
      display.setAttribute('aria-label',label+' به تقویم هجری شمسی');display.setAttribute('aria-haspopup','dialog');display.setAttribute('aria-expanded','false');
      original.id=oldId+'Iso';original.type='hidden';original.required=false;original.removeAttribute('class');
      const wrapper=document.createElement('div');wrapper.className='jalali-date-control';original.parentNode.insertBefore(wrapper,original);wrapper.appendChild(display);
      const trigger=document.createElement('button');trigger.type='button';trigger.className='jalali-date-trigger';trigger.setAttribute('aria-label','باز کردن تقویم شمسی برای '+label);trigger.innerHTML='<span aria-hidden="true">▦</span><span>تقویم شمسی</span>';wrapper.appendChild(trigger);
      const popover=document.createElement('div');popover.className='jalali-date-popover';popover.hidden=true;popover.setAttribute('role','dialog');popover.setAttribute('aria-label','تقویم هجری شمسی');wrapper.appendChild(popover);wrapper.appendChild(original);
      let viewISO=/^\d{4}-\d{2}-\d{2}$/.test(value)?value:isoFromDate(new Date());
      const showDate=iso=>{display.value=/^\d{4}-\d{2}-\d{2}$/.test(iso)?jalaliFullDateFormatter.format(dateFromISO(iso)):'';};showDate(viewISO);
      const close=()=>{popover.hidden=true;display.setAttribute('aria-expanded','false');trigger.setAttribute('aria-expanded','false');};
      const render=()=>{
        let focus=dateFromISO(viewISO);if(Number.isNaN(focus.getTime()))focus=new Date();
        const start=jalaliMonthStart(focus),mp=jalaliDateParts(start),offset=(start.getDay()+1)%7;let days=0;
        for(let i=0;i<31;i++){const p=jalaliDateParts(shiftDate(start,i));if(p.year!==mp.year||p.month!==mp.month)break;days++;}
        let html='<div class="jalali-date-popover-head"><button type="button" data-jalali-month="-1" aria-label="ماه قبل">‹</button><strong>'+h(jalaliMonthFormatter.format(start))+'</strong><button type="button" data-jalali-month="1" aria-label="ماه بعد">›</button></div>';
        html+='<div class="jalali-date-weekdays"><span>ش</span><span>ی</span><span>د</span><span>س</span><span>چ</span><span>پ</span><span>ج</span></div><div class="jalali-date-days">';
        for(let i=0;i<offset;i++)html+='<span class="jalali-date-blank" aria-hidden="true"></span>';
        for(let i=0;i<days;i++){const date=shiftDate(start,i),iso=isoFromDate(date),disabled=(min&&iso<min)||(max&&iso>max),selected=iso===original.value;html+='<button type="button" data-jalali-date="'+iso+'"'+(disabled?' disabled':'')+(selected?' aria-pressed="true" class="selected"':'')+' aria-label="'+h(jalaliFullDateFormatter.format(date))+'">'+h(jalaliDayNumberFormatter.format(date))+'</button>';}
        popover.innerHTML=html+'</div><div class="jalali-date-popover-foot"><button type="button" data-jalali-close>بستن</button></div>';
      };
      const open=()=>{document.querySelectorAll('.jalali-date-popover:not([hidden])').forEach(n=>{if(n!==popover)n.hidden=true;});viewISO=original.value||isoFromDate(new Date());render();popover.hidden=false;display.setAttribute('aria-expanded','true');trigger.setAttribute('aria-expanded','true');};
      trigger.addEventListener('click',()=>popover.hidden?open():close());display.addEventListener('click',()=>popover.hidden?open():close());
      popover.addEventListener('click',event=>{const button=event.target.closest('button');if(!button)return;if(button.dataset.jalaliMonth){const start=jalaliMonthStart(dateFromISO(viewISO));viewISO=isoFromDate(shiftDate(start,Number(button.dataset.jalaliMonth)<0?-1:35));render();return;}if(button.dataset.jalaliClose!==undefined){close();return;}if(button.dataset.jalaliDate){original.value=button.dataset.jalaliDate;viewISO=original.value;showDate(original.value);original.dispatchEvent(new Event('input',{bubbles:true}));original.dispatchEvent(new Event('change',{bubbles:true}));close();}});
      if(isRequired)display.title='انتخاب تاریخ الزامی است';
    });
    if(document.documentElement.dataset.jalaliOutsideListener!=='true'){document.documentElement.dataset.jalaliOutsideListener='true';document.addEventListener('click',event=>{if(event.target.closest('.jalali-date-control'))return;document.querySelectorAll('.jalali-date-popover:not([hidden])').forEach(n=>n.hidden=true);document.querySelectorAll('.jalali-date-display[aria-expanded="true"],.jalali-date-trigger[aria-expanded="true"]').forEach(n=>n.setAttribute('aria-expanded','false'));});}
  }
  function attachPasswordToggles(scope) {
    if (!scope) return;
    scope.querySelectorAll('input[type="password"]').forEach(input => {
      if (input.dataset.passwordToggleReady === 'true') return;
      input.dataset.passwordToggleReady = 'true';
      const wrap = document.createElement('div');
      wrap.className = 'password-input-wrap';
      input.parentNode.insertBefore(wrap,input);
      wrap.appendChild(input);
      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'password-toggle';
      toggle.setAttribute('aria-label','نمایش رمز عبور');
      toggle.title = 'نمایش رمز عبور';
      const eyeOpen = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.2 12s3.5-6.3 9.8-6.3 9.8 6.3 9.8 6.3-3.5 6.3-9.8 6.3S2.2 12 2.2 12Z"/><circle cx="12" cy="12" r="3"/></svg>';
      const eyeClosed = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10.6 5.9A10.9 10.9 0 0 1 12 5.7c6.3 0 9.8 6.3 9.8 6.3a17.4 17.4 0 0 1-3.1 3.7M6.2 6.8C3.7 8.5 2.2 12 2.2 12s3.5 6.3 9.8 6.3a10.8 10.8 0 0 0 4.1-.8"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>';
      toggle.innerHTML = eyeOpen;
      toggle.addEventListener('click',() => {
        const reveal = input.type === 'password';
        input.type = reveal ? 'text' : 'password';
        toggle.innerHTML = reveal ? eyeClosed : eyeOpen;
        toggle.setAttribute('aria-label',reveal ? 'پنهان کردن رمز عبور' : 'نمایش رمز عبور');
        toggle.title = reveal ? 'پنهان کردن رمز عبور' : 'نمایش رمز عبور';
      });
      wrap.appendChild(toggle);
    });
  }
  function errorMessage(error) {
    const text = String(error && error.message ? error.message : error || '');
    return errorLabels[text] || text || 'خطای نامشخص';
  }
  async function api(path, method = 'GET', body = undefined) {
    if (!API_BASE) throw new Error('آدرس API در config.js تنظیم نشده است.');
    const publicKey = String(cfg.SUPABASE_PUBLISHABLE_KEY || '');
    if (!publicKey || publicKey.includes('YOUR-PUBLISHABLE-KEY')) {
      throw new Error('کلید عمومی Supabase هنوز در config.js تنظیم نشده است.');
    }
    const headers = { 'Accept':'application/json', 'apikey': publicKey };
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
  function setSeoLanding(show) {
    const section = document.getElementById('seoLanding');
    if (section) section.hidden = !show;
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
    attachJalaliDatePickers(root);
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', logout);
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) refreshBtn.addEventListener('click', () => loadDashboard());
  }
  function showLogin(initialRole = APP_ROLE, initialMode = 'login') {
    setSeoLanding(true);
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
            <h2>${APP_ROLE === 'doctor' ? 'مدیریت متمرکز مراقبت بیماران.' : 'پرونده شما، برنامه پیگیری و مراقبت مستمر.'}</h2>
            <p>${APP_ROLE === 'doctor' ? 'مشاهده و تأیید بیماران، بررسی گزارش‌ها، مدیریت نوبت‌ها و ثبت برنامه پیگیری از پنل پزشک.' : 'دسترسی به سوابق پرونده، برنامه پیگیری، داروها و یادداشت‌های پزشک؛ همراه با ثبت علائم و مدیریت نوبت‌ها.'}</p>
          </div>
          <div class="aside-points">
            <div class="aside-point"><span>✓</span><div><b>سوابق پرونده پزشکی</b><small>مشاهده یادداشت‌ها، گزارش علائم و اطلاعات ثبت‌شده برای حساب خودتان.</small></div></div>
            <div class="aside-point"><span>✓</span><div><b>برنامه درمان و پیگیری</b><small>برنامه پیگیری و داروهای ثبت‌شده توسط پزشک را دنبال کنید.</small></div></div>
            <div class="aside-point"><span>↗</span><div><b>ثبت علائم و پیگیری</b><small>گزارش وضعیت خود را برای بررسی پزشک در سوابق ثبت کنید.</small></div></div>
          </div>
        </aside>
      </div>`;
    renderLoginForm(mode);
  }
  async function loadCaptcha(form) {
    if (APP_ROLE === 'doctor' || !form) return;
    const question = form.querySelector('#captchaQuestion');
    const challengeId = form.querySelector('#captchaId');
    const answer = form.querySelector('#captchaAnswer');
    if (!question || !challengeId || !answer) return;
    question.textContent = 'در حال بارگذاری…';
    challengeId.value = '';
    answer.value = '';
    const refresh = form.querySelector('#refreshCaptcha');
    if (refresh) refresh.disabled = true;
    try {
      const data = await api('/captcha/challenge','POST',{});
      question.textContent = data.question || '—';
      challengeId.value = data.challengeId || '';
    } catch (_) {
      question.textContent = 'بارگذاری ناموفق بود';
    } finally {
      if (refresh) refresh.disabled = false;
    }
  }
  function renderLoginForm(mode) {
    const area = document.getElementById('loginFormArea');
    if (!area) return;
    const isDoctor = APP_ROLE === 'doctor';
    const isRegister = !isDoctor && mode === 'register';
    area.innerHTML = `
      <h1>${isDoctor ? 'ورود به پنل پزشک' : (isRegister ? 'ساخت حساب بیمار' : 'ورود بیمار')}</h1>
      <p class="lead">${isDoctor ? 'برای ورود به پنل، مشخصات حساب پزشک را وارد کنید.' : (isRegister ? 'اطلاعات خود را ثبت کنید تا پزشک حساب را بررسی و فعال کند.' : 'برای ورود، کد ملی و رمز عبور خود را وارد کنید.')}</p>
      <form id="authForm" novalidate>
        <div class="form-grid">
          ${isDoctor ? `
            <div class="field full"><label for="clinicCode">کد ورود پزشک</label><input id="clinicCode" name="clinicCode" autocomplete="username" value="${h(CLINIC_CODE)}" required></div>
            <div class="field full"><label for="password">رمز عبور پزشک</label><input id="password" type="password" name="password" autocomplete="current-password" required minlength="8"></div>
          ` : `
            ${isRegister ? `
              <div class="field"><label for="firstName">نام</label><input id="firstName" name="firstName" autocomplete="given-name" required maxlength="100"></div>
              <div class="field"><label for="lastName">نام خانوادگی</label><input id="lastName" name="lastName" autocomplete="family-name" required maxlength="100"></div>
              <div class="field full"><label for="diseaseCode">حوزه پیگیری</label><select id="diseaseCode" name="diseaseCode" required><option value="" disabled selected>حوزه پیگیری را انتخاب کنید</option>${diseases.map(d => '<option value="' + h(d[0]) + '">' + h(d[1]) + '</option>').join('')}</select></div>
              <div class="field full"><div class="fixed-clinic"><span>مرکز پیگیری</span><strong>کلینیک دکتر صفاری</strong><small>کد کلینیک ثابت است و قابل تغییر نیست.</small></div></div>
              <div class="field full"><label for="mobile">شماره موبایل (الزامی)</label><input id="mobile" name="mobile" inputmode="numeric" autocomplete="tel" placeholder="09123456789" pattern="09[0-9]{9}" required maxlength="11"></div>
            ` : ''}
            <div class="field full"><label for="nationalId">کد ملی / نام کاربری</label><input id="nationalId" name="nationalId" inputmode="numeric" autocomplete="username" placeholder="کد ملی ۱۰ رقمی" pattern="[0-9]{10}" required maxlength="10"></div>
            <div class="field full"><label for="password">${isRegister ? 'انتخاب رمز عبور امن' : 'رمز عبور'}</label><input id="password" name="password" type="password" autocomplete="${isRegister ? 'new-password' : 'current-password'}" required minlength="8" maxlength="12" pattern="[!-~]{8,12}" placeholder="${isRegister ? '۸ تا ۱۲ نویسه انگلیسی' : 'رمز عبور حساب'}"></div>
            ${isRegister ? '<div class="field full"><label for="confirmPassword">تکرار رمز عبور</label><input id="confirmPassword" name="confirmPassword" type="password" autocomplete="new-password" required minlength="8" maxlength="12" pattern="[!-~]{8,12}"></div>' : ''}
          `}
        </div>
        ${!isDoctor ? `
          <div class="captcha-box">
            <label for="captchaAnswer">کپچای امنیتی: <strong id="captchaQuestion">در حال بارگذاری…</strong></label>
            <div class="captcha-row">
              <input id="captchaAnswer" name="captchaAnswer" inputmode="numeric" pattern="[0-9]{1,2}" maxlength="2" placeholder="پاسخ" required>
              <button class="ghost-button" id="refreshCaptcha" type="button">سؤال تازه</button>
            </div>
            <input id="captchaId" name="captchaId" type="hidden" value="">
          </div>
          <p class="hint">${isRegister ? 'نام کاربری شما کد ملی است. رمز باید ۸ تا ۱۲ نویسه انگلیسی و شامل حرف، عدد و نماد باشد.' : 'با کد ملی و رمز عبوری که هنگام ثبت‌نام انتخاب کرده‌اید وارد شوید.'}</p>
        ` : ''}
        <button class="primary full-button" type="submit">${isDoctor ? 'ورود به پنل پزشک' : (isRegister ? 'ثبت‌نام و ارسال برای بررسی' : 'ورود به حساب بیمار')}</button>
        <div class="form-message"></div>
      </form>
      <div class="auth-footer">
        ${isDoctor ? '<span>دسترسی فقط برای پزشک مجاز است.</span>' : (isRegister ? '<span>قبلاً حساب ساخته‌اید؟</span><button class="link-button" type="button" id="modeLogin">ورود به حساب</button>' : '<span>حساب ندارید؟</span><button class="link-button" type="button" id="modeRegister">ثبت‌نام بیمار</button>')}
      </div>`;
    attachPasswordToggles(area);
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
        } else {
          const nationalId = normalizeDigits(fd.get('nationalId')).trim();
          const password = String(fd.get('password') || '');
          const captchaId = String(fd.get('captchaId') || '');
          const captchaAnswer = normalizeDigits(fd.get('captchaAnswer')).trim();
          if (!/^\d{10}$/.test(nationalId)) { setMessage(form,'کد ملی باید دقیقاً ۱۰ رقم باشد.','error'); return; }
          if (!captchaId || !/^\d{1,2}$/.test(captchaAnswer)) { setMessage(form,'پاسخ کپچا را وارد کنید.','error'); return; }
          if (isRegister) {
            const diseaseCode = String(fd.get('diseaseCode') || '');
            if (!diseaseCode) { setMessage(form,'حوزه پیگیری را انتخاب کنید.','error'); return; }
            const mobile = normalizeDigits(fd.get('mobile')).trim();
            const confirmPassword = String(fd.get('confirmPassword') || '');
            if (!/^09\d{9}$/.test(mobile)) { setMessage(form,'شماره موبایل باید با 09 شروع شود و ۱۱ رقم داشته باشد.','error'); return; }
            if (!/^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z0-9])[\x21-\x7e]{8,12}$/.test(password)) { setMessage(form,'رمز باید ۸ تا ۱۲ نویسه انگلیسی و شامل حرف، عدد و نماد باشد.','error'); return; }
            if (password !== confirmPassword) { setMessage(form,'تکرار رمز عبور یکسان نیست.','error'); return; }
            data = await api('/patients/register','POST',{
              firstName:fd.get('firstName'),lastName:fd.get('lastName'),mobile:fd.get('mobile'),
              nationalId,password,diseaseCode:fd.get('diseaseCode'),clinicCode:CLINIC_CODE,captchaId,captchaAnswer
            });
          } else {
            data = await api('/patients/login','POST',{nationalId,password,captchaId,captchaAnswer});
          }
        }
        token = String(data.token || '');
        role = APP_ROLE;
        if (!token) throw new Error('سرور توکن ورود را برنگرداند.');
        sessionStorage.setItem('snc_token',token);
        sessionStorage.setItem('snc_role',role);
        await loadDashboard();
      } catch (error) {
        setMessage(form,errorMessage(error),'error');
        if (!isDoctor) await loadCaptcha(form);
      } finally {
        if (document.body.contains(submit)) {
          submit.disabled = false;
          submit.textContent = isDoctor ? 'ورود به پنل پزشک' : (isRegister ? 'ثبت‌نام و ارسال برای بررسی' : 'ورود به حساب بیمار');
        }
      }
    });
    const loginBtn = document.getElementById('modeLogin');
    if (loginBtn) loginBtn.addEventListener('click',() => renderLoginForm('login'));
    const registerBtn = document.getElementById('modeRegister');
    if (registerBtn) registerBtn.addEventListener('click',() => renderLoginForm('register'));
    if (!isDoctor) {
      document.getElementById('refreshCaptcha')?.addEventListener('click',() => loadCaptcha(form));
      loadCaptcha(form);
    }
  }
  async function loadDashboard() {
    if (!token) return showLogin(APP_ROLE,'login');
    setSeoLanding(false);
    if (APP_ROLE === 'doctor') return loadDoctorDashboard();
    return loadPatientDashboard();
  }
  function metric(label,value,sub='') {
    return '<div class="metric"><span class="label">' + h(label) + '</span><strong>' + h(value) + '</strong>' + (sub ? '<small>' + h(sub) + '</small>' : '') + '</div>';
  }
  function appointmentCard(a) {
    const isText = a.appointmentType === 'text';
    return `<div class="appointment-card">
      <div class="appointment-top"><div><div class="patient-name">${h(fmtDate(a.preferredDate))} · ${h(String(a.preferredTime || '').slice(0,5))}</div><span class="appt-type-label ${isText ? 'text' : 'in-person'}">${isText ? 'مشاوره متنی' : 'نوبت حضوری در مطب'}</span><div class="subline">${h(a.reason || 'بدون توضیح')}</div></div><span class="badge ${h(a.status)}">${h(statusTitle(a.status))}</span></div>
      ${isText && a.status === 'requested' ? '<div class="consultation-notice">برای تأیید درخواست مشاوره متنی، با مطب تماس بگیرید: <a href="tel:09961364434"><strong>09961364434</strong></a>.</div>' : ''}
      ${a.consultationUrl ? '<a class="eitaa-link" href="' + h(a.consultationUrl) + '" target="_blank" rel="noopener">شروع گفت‌وگو در ایتا (@Dr_Saffari)</a>' : ''}
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
    attachPasswordToggles(root);
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

  function conditionResourceSection(code) {
    const resources = {
      ms: {icon:'MS',title:'همراه تخصصی ام‌اس',description:'برای استفاده از آموزش‌ها و ابزارهای اختصاصی پیگیری ام‌اس، وارد اپ همراه ام‌اس شوید.',button:'ورود به اپ همراه ام‌اس',href:'https://ms.mhsaffari.ir/',hint:'آموزش و پیگیری ویژه ام‌اس'},
      migraine: {icon:'✦',title:'راهنمای میگرن و سردرد',description:'مقالات آموزشی درباره سردرد، محرک‌ها، تشخیص و مسیرهای درمان را مطالعه کنید.',button:'مطالعه مقالات میگرن و سردرد',href:'https://mhsaffari.ir/articles-migraine-headache.html',hint:'وب‌سایت رسمی دکتر صفاری'},
      stroke: {icon:'＋',title:'راهنمای سکته مغزی',description:'با علائم هشدار، انواع سکته، عوامل خطر، درمان و راه‌های پیشگیری آشنا شوید.',button:'مطالعه راهنمای سکته مغزی',href:'https://mhsaffari.ir/articles/neurology/stroke-cva-symptoms-types-causes-treatment-prevention.html',hint:'اطلاعات آموزشی معتبر'},
      vertigo: {icon:'◉',title:'راهنمای سرگیجه و اختلال تعادل',description:'علل شایع سرگیجه، روش‌های بررسی و گزینه‌های درمانی را مرور کنید.',button:'مطالعه مقاله سرگیجه',href:'https://mhsaffari.ir/articles/neurology/vertigo-causes-symptoms-diagnosis-treatment.html',hint:'راهنمای آموزشی نورولوژی'},
      myasthenia_gravis: {icon:'↯',title:'راهنمای میاستنی گراویس',description:'با علائم، علت‌ها، روش‌های تشخیص و مسیرهای درمان میاستنی گراویس آشنا شوید.',button:'مطالعه مقاله میاستنی گراویس',href:'https://mhsaffari.ir/articles/neurology/myasthenia-gravis-symptoms-causes-diagnosis-treatment.html',hint:'راهنمای آموزشی نورولوژی'},
      neuropathy: {icon:'⌁',title:'راهنمای بیماری‌های عصب و عضله',description:'مقاله آموزشی نوروپاتی، میوپاتی و ALS را برای آشنایی با علائم و روش‌های بررسی بخوانید.',button:'مطالعه مقاله بیماری‌های عصب و عضله',href:'https://mhsaffari.ir/articles/neurology/neuropathy-myopathy-als-neuromuscular-disorders-symptoms-diagnosis-treatment.html',hint:'راهنمای آموزشی نورولوژی'},
      myopathy: {icon:'⌁',title:'راهنمای بیماری‌های عصب و عضله',description:'مقاله آموزشی نوروپاتی، میوپاتی و ALS را برای آشنایی با علائم و روش‌های بررسی بخوانید.',button:'مطالعه مقاله بیماری‌های عصب و عضله',href:'https://mhsaffari.ir/articles/neurology/neuropathy-myopathy-als-neuromuscular-disorders-symptoms-diagnosis-treatment.html',hint:'راهنمای آموزشی نورولوژی'},
      als: {icon:'⌁',title:'راهنمای بیماری‌های عصب و عضله',description:'مقاله آموزشی نوروپاتی، میوپاتی و ALS را برای آشنایی با علائم و روش‌های بررسی بخوانید.',button:'مطالعه مقاله بیماری‌های عصب و عضله',href:'https://mhsaffari.ir/articles/neurology/neuropathy-myopathy-als-neuromuscular-disorders-symptoms-diagnosis-treatment.html',hint:'راهنمای آموزشی نورولوژی'},
      parkinson: {icon:'✧',title:'راهنمای بیماری پارکینسون',description:'اطلاعاتی درباره علائم، تشخیص و درمان پارکینسون در وب‌سایت رسمی.',button:'مطالعه مقاله پارکینسون',href:'https://mhsaffari.ir/articles/neurology/parkinson.html',hint:'راهنمای آموزشی نورولوژی'},
      cognition: {icon:'◌',title:'راهنمای اختلالات شناختی و حافظه',description:'فراموشی، اختلال شناختی و بیماری‌های مرتبط با حافظه را بهتر بشناسید.',button:'مطالعه مقاله حافظه و اختلال شناختی',href:'https://mhsaffari.ir/articles/neurology/forgetfulness-alzheimer-dementia-parkinson-transient-global-amnesia.html',hint:'راهنمای آموزشی نورولوژی'},
      epilepsy: {icon:'⚡',title:'راهنمای تشنج و صرع',description:'با تفاوت تشنج و صرع، علائم، ارزیابی و زمان‌های نیازمند اقدام فوری آشنا شوید.',button:'مطالعه مقاله تشنج و صرع',href:'https://mhsaffari.ir/articles/neurology/seizure-what-is-difference-epilepsy-symptoms-causes-diagnosis-emergency.html',hint:'راهنمای آموزشی نورولوژی'},
      low_back_pain: {icon:'↕',title:'راهنمای کمردرد و سیاتیک',description:'علت‌ها، علائم هشدار و مسیرهای بررسی و درمان کمردرد را مطالعه کنید.',button:'مطالعه مقاله کمردرد و سیاتیک',href:'https://mhsaffari.ir/articles/neurology/low-back-pain-sciatica-causes-symptoms-diagnosis-treatment.html',hint:'راهنمای آموزشی نورولوژی'},
      other: {icon:'＋',title:'کتابخانه آموزش مغز و اعصاب',description:'برای آشنایی با سایر بیماری‌ها و موضوعات نورولوژی، مقالات سایت رسمی را ببینید.',button:'مشاهده مقالات مغز و اعصاب',href:'https://mhsaffari.ir/articles-neurology.html',hint:'کتابخانه آموزشی دکتر صفاری'},
      unassigned: {icon:'＋',title:'کتابخانه آموزش مغز و اعصاب',description:'برای آشنایی با بیماری‌ها و موضوعات مختلف نورولوژی، مقالات سایت رسمی را ببینید.',button:'مشاهده مقالات مغز و اعصاب',href:'https://mhsaffari.ir/articles-neurology.html',hint:'کتابخانه آموزشی دکتر صفاری'}
    };
    const item = resources[code] || resources.other;
    return '<section class="panel condition-resource-panel" aria-label="منبع آموزشی مرتبط با بیماری">' +
      '<div class="condition-resource-copy"><span class="condition-resource-eyebrow">منبع مرتبط با حوزه پیگیری شما</span><h2>' + h(item.title) + '</h2><p>' + h(item.description) + '</p></div>' +
      '<a class="condition-resource-button" href="' + h(item.href) + '" target="_blank" rel="noopener noreferrer"><span class="condition-resource-icon">' + h(item.icon) + '</span><span class="condition-resource-label"><strong>' + h(item.button) + '</strong><small>' + h(item.hint) + '</small></span><b aria-hidden="true">←</b></a>' +
      '</section>';
  }

  function patientEdssPanel(scores) {
    const rows = Array.isArray(scores) ? scores : [];
    const history = rows.length
      ? '<div class="row-list">' + rows.map(s => '<div class="row-item edss-history-item"><div><strong>نمره EDSS: ' + h(Number(s.score_value).toFixed(1)) + '</strong><p>' + h(s.notes || 'توضیحی برای این ارزیابی ثبت نشده است.') + '</p></div><small class="subline">' + h(fmtDate(s.assessed_on)) + '</small></div>').join('') + '</div>'
      : '<div class="empty-card">هنوز ارزیابی EDSS در پرونده شما ثبت نشده است. در صورت نیاز، پزشک در جلسه ارزیابی این شاخص را ثبت می‌کند.</div>';
    return '<section class="panel edss-panel"><div class="panel-heading"><h2>روند ارزیابی EDSS</h2><small>' + rows.length + ' ارزیابی</small></div>' +
      '<p class="edss-explainer">EDSS شاخصی برای ثبت سطح ناتوانی در ام‌اس است. اعداد این بخش فقط از ارزیابی پزشک نمایش داده می‌شوند و جایگزین توضیح و تصمیم بالینی پزشک نیستند.</p>' +
      history + '</section>';
  }

  function patientDiseaseSettings(profile) {
    const options=diseases.map(d=>'<option value="'+h(d[0])+'"'+(d[0]===profile.diseaseCode?' selected':'')+'>'+h(d[1])+'</option>').join('');
    return '<section class="panel disease-settings-panel"><div class="panel-heading"><h2>حوزه پیگیری من</h2><small>قابل اصلاح توسط بیمار</small></div>'+
      '<p class="disease-settings-current">حوزه ثبت‌شده فعلی: <strong>'+h(diseaseTitle(profile.diseaseCode,profile.customDiseaseLabel))+'</strong></p>'+
      '<form id="patientDiseaseForm"><div class="form-grid"><div class="field full"><label for="patientDiseaseSelect">حوزه صحیح بیماری یا پیگیری را انتخاب کنید</label><select id="patientDiseaseSelect" name="diseaseCode" required>'+options+'</select></div></div>'+
      '<div class="disease-loss-warning"><strong>توجه: تغییر حوزه، پرونده فعلی را پاک می‌کند.</strong><p>در صورت تغییر واقعی، سوابق گزارش علائم، یادداشت‌های پزشک، برنامه‌های پیگیری، داروها، نمره‌های EDSS و همه نوبت‌های قبلی به‌صورت دائمی حذف می‌شوند. حساب کاربری و وضعیت تأیید باقی می‌ماند و این حذف قابل بازگشت نیست.</p></div>'+
      '<button class="secondary full-button" type="submit">اصلاح حوزه پیگیری</button><div class="form-message"></div></form></section>';
  }
  function bindPatientDiseaseForm(profile) {
    const form=document.getElementById('patientDiseaseForm');if(!form)return;
    const select=form.querySelector('select[name="diseaseCode"]');
    form.addEventListener('submit',async event=>{
      event.preventDefault();const nextDisease=String(select.value||'');
      if(nextDisease===profile.diseaseCode){setMessage(form,'حوزه پیگیری شما تغییری نکرده است.','ok');return;}
      const confirmed=window.confirm('هشدار مهم: با تغییر حوزه از «'+diseaseTitle(profile.diseaseCode,profile.customDiseaseLabel)+'» به «'+diseaseTitle(nextDisease)+'»، تمام سوابق پزشکی مرتبط با حوزه فعلی، از جمله گزارش‌ها، یادداشت‌ها، برنامه‌های پیگیری، داروها، EDSS و نوبت‌های قبلی، برای همیشه حذف می‌شوند. حساب کاربری و وضعیت تأیید باقی می‌ماند. این کار قابل بازگشت نیست. ادامه می‌دهید؟');
      if(!confirmed){select.value=profile.diseaseCode;return;}
      const button=form.querySelector('button[type="submit"]');button.disabled=true;
      try{await api('/patients/disease','POST',{diseaseCode:nextDisease,confirmPurge:true});alert('حوزه پیگیری به‌روزرسانی شد. پرونده جدید با حوزه انتخاب‌شده باز می‌شود.');await loadDashboard();}
      catch(error){setMessage(form,errorMessage(error),'error');button.disabled=false;select.value=profile.diseaseCode;}
    });
  }
  async function loadPatientDashboard() {
    root.innerHTML = '<section class="loading-card"><div class="spinner"></div><p>در حال دریافت اطلاعات حساب…</p></section>';
    try {
      const profile = (await api('/patients/me')).patient;
      currentPatient = profile;
      if (profile.requiresPasswordChange) { renderPasswordChange(); return; }
      const active = profile.status === 'active';
      let appointments = [], reports = [], notes = [], plans = [], medications = [], clinicalScores = [];
      if (active) {
        const requests = [
          api('/patients/appointments'), api('/patients/reports'), api('/patients/notes'),
          api('/patients/treatment-plan'), api('/patients/medications')
        ];
        if (profile.diseaseCode === 'ms') requests.push(api('/patients/clinical-scores'));
        const values = await Promise.allSettled(requests);
        appointments = values[0].status === 'fulfilled' ? values[0].value.appointments || [] : [];
        reports = values[1].status === 'fulfilled' ? values[1].value.reports || [] : [];
        notes = values[2].status === 'fulfilled' ? values[2].value.notes || [] : [];
        plans = values[3].status === 'fulfilled' ? values[3].value.plans || [] : [];
        medications = values[4].status === 'fulfilled' ? values[4].value.medications || [] : [];
        clinicalScores = profile.diseaseCode === 'ms' && values[5]?.status === 'fulfilled' ? values[5].value.scores || [] : [];
      }
      const hasCompletedVisit = appointments.some(a => a.status === 'completed');
      root.innerHTML = `
        <div class="dash-head">
          <div><h1>سلام ${h(profile.firstName || 'بیمار')} عزیز</h1><p>پرونده سلامت و پیگیری درمان · ${h(diseaseTitle(profile.diseaseCode,profile.customDiseaseLabel))}</p></div>
          ${headerActions()}
        </div>
        ${!active ? '<div class="notice-card warning"><strong>' + h(statusTitle(profile.status)) + '</strong><br>پس از بررسی حساب توسط پزشک، امکانات ثبت نوبت و پیگیری فعال می‌شود. تا آن زمان اطلاعات پزشکی دیگری وارد نکنید.</div>' : ''}
        <div class="metrics">
          ${metric('برنامه پیگیری',String(plans.length),'برنامه‌های ثبت‌شده پزشک')}
          ${metric('یادداشت‌های پزشک',String(notes.length),'سوابق قابل مشاهده')}
          ${metric('داروهای ثبت‌شده',String(medications.length),'طبق دستور پزشک')}
          ${metric('گزارش علائم',String(reports.length),'ثبت‌ها و پیش‌ویزیت‌ها')}
        </div>
        ${conditionResourceSection(profile.diseaseCode)}
        ${patientDiseaseSettings(profile)}
        ${active ? `
        <div class="content-grid">
          <div class="stack">
            ${profile.diseaseCode === 'ms' ? patientEdssPanel(clinicalScores) : ''}
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
                          <div class="panel-heading"><h2>گزارش‌های قبلی</h2><small>${reports.length} مورد</small></div>
                          <div class="row-list">${reports.length ? reports.map(r => '<div class="row-item"><div><strong>' + h(statusTitle(r.report_type)) + ' · شدت ' + h(r.severity || '—') + '</strong><p>' + h([...(Array.isArray(r.symptoms) ? r.symptoms : []),r.notes].filter(Boolean).join('، ')) + '</p></div><small class="subline">' + h(fmtDate(r.submitted_at)) + '</small></div>').join('') : '<div class="empty-card">هنوز گزارشی ثبت نشده است.</div>'}</div>
                        </section>
            <section class="panel">
                          <div class="panel-heading"><h2>گزارش علائم / پیش از ویزیت</h2><small>گزارش برای بررسی پزشک</small></div>
                          <form id="reportForm">
                            <div class="field full">
                              <span class="report-type-label">نوع گزارش را انتخاب کنید</span>
                              <input type="hidden" id="reportType" name="reportType" value="${hasCompletedVisit ? 'symptom' : 'initial_visit'}">
                              <div class="report-type-options" role="group" aria-label="نوع گزارش">
                                <button type="button" class="report-type-btn ${hasCompletedVisit ? '' : 'active'}" data-report-type="initial_visit" aria-pressed="${hasCompletedVisit ? 'false' : 'true'}"><strong>شرح حال اولیه</strong><small>اولین مراجعه</small></button>
                                <button type="button" class="report-type-btn ${hasCompletedVisit ? 'active' : ''}" data-report-type="symptom" aria-pressed="${hasCompletedVisit ? 'true' : 'false'}"><strong>ثبت علائم</strong><small>علامت تازه یا تغییر</small></button>
                                <button type="button" class="report-type-btn" data-report-type="pre_visit" aria-pressed="false"><strong>پیش از ویزیت</strong><small>نکته یا پرسش</small></button>
                              </div>
                              <small class="field-help">برای اولین مراجعه «شرح حال اولیه» و برای گزارش تغییرات روزانه «ثبت علائم» را انتخاب کنید.</small>
                            </div>
                            <div id="initialVisitFields" class="initial-visit-fields" ${hasCompletedVisit ? 'hidden' : ''}>
                              <div class="field full"><label for="initialMainConcern">مشکل اصلی و علت مراجعه</label><textarea id="initialMainConcern" name="initialMainConcern" maxlength="200" placeholder="مهم‌ترین مشکلی که می‌خواهید پزشک بررسی کند" rows="2"></textarea></div>
                              <div class="form-grid">
                                <div class="field"><label for="initialOnset">از چه زمانی شروع شده؟</label><input id="initialOnset" name="initialOnset" maxlength="200" placeholder="مثلاً سه ماه قبل"></div>
                                <div class="field"><label for="initialDiagnosis">تشخیص‌های قبلی</label><input id="initialDiagnosis" name="initialDiagnosis" maxlength="200" placeholder="اگر تشخیصی داشته‌اید"></div>
                                <div class="field"><label for="initialMedications">داروهای فعلی</label><input id="initialMedications" name="initialMedications" maxlength="200" placeholder="نام داروها و دوز در صورت اطلاع"></div>
                                <div class="field"><label for="initialTests">آزمایش، MRI یا بررسی قبلی</label><input id="initialTests" name="initialTests" maxlength="200" placeholder="بررسی‌های انجام‌شده"></div>
                                <div class="field full"><label for="initialHistory">بیماری‌های زمینه‌ای یا حساسیت دارویی</label><input id="initialHistory" name="initialHistory" maxlength="200" placeholder="در صورت وجود"></div>
                              </div>
                            </div>
                            <div class="field full"><label>علائم اخیر (چند مورد قابل انتخاب است)</label><div class="symptom-options">
                              <label class="symptom-chip"><input type="checkbox" name="symptoms" value="headache"><span>سردرد</span></label>
                              <label class="symptom-chip"><input type="checkbox" name="symptoms" value="fatigue"><span>خستگی</span></label>
                              <label class="symptom-chip"><input type="checkbox" name="symptoms" value="numbness"><span>گزگز / بی‌حسی</span></label>
                              <label class="symptom-chip"><input type="checkbox" name="symptoms" value="vision"><span>مشکل بینایی</span></label>
                              <label class="symptom-chip"><input type="checkbox" name="symptoms" value="balance"><span>اختلال تعادل</span></label>
                              <label class="symptom-chip"><input type="checkbox" name="symptoms" value="sleep"><span>اختلال خواب</span></label>
                              <label class="symptom-chip"><input type="checkbox" name="symptoms" value="other"><span>سایر</span></label>
                            </div></div>
                            <div id="otherSymptomField" class="field full" hidden><label for="otherSymptom">علامت دیگر خود را وارد کنید (حداکثر ۲۰۰ نویسه)</label><input id="otherSymptom" name="otherSymptom" maxlength="200" placeholder="علامتی که در فهرست بالا وجود ندارد"></div>
                            <div class="form-grid" style="margin-top:14px">
                              <div class="field"><label for="severity">شدت کلی علامت (۱ تا ۱۰)</label><input id="severity" type="number" name="severity" min="1" max="10" required></div>
                              <div class="field"><label for="occurredOn">تاریخ شروع / گزارش</label><input id="occurredOn" type="date" name="occurredOn" value="${new Date().toISOString().slice(0,10)}"></div>
                              <div class="field full"><label for="reportNotes">توضیحات تکمیلی (حداکثر ۲۰۰ نویسه)</label><textarea id="reportNotes" name="notes" maxlength="200" rows="3" placeholder="زمان شروع، مدت، شدت و تغییر علائم یا هر نکته مهم دیگر"></textarea></div>
                            </div>
                            <button class="primary full-button" type="submit">ارسال گزارش به پزشک</button><div class="form-message"></div>
                          </form>                   </form>
                        </section>
          </div>
          <div class="stack">
            <section class="panel">
                          <div class="panel-heading"><h2>درخواست نوبت</h2><small>نوبت پس از تأیید مطب قطعی است</small></div>
                          <form id="appointmentForm">
                            <div class="form-grid">
                              <div class="field full"><label for="appointmentType">نوع نوبت</label><select id="appointmentType" name="appointmentType"><option value="in_person">نوبت حضوری در مطب</option><option value="text">مشاوره متنی</option></select></div>
                              <div class="field full">
                                <label for="calendarDays">روز قابل رزرو (تقویم هجری شمسی)</label>
                                <div class="jalali-calendar" id="jalaliCalendar">
                                  <div class="jalali-calendar-head">
                                    <button type="button" class="calendar-nav" id="calendarPrev" aria-label="ماه قبل" disabled>‹</button>
                                    <strong id="calendarMonthLabel">در حال دریافت زمان‌ها…</strong>
                                    <button type="button" class="calendar-nav" id="calendarNext" aria-label="ماه بعد" disabled>›</button>
                                  </div>
                                  <div class="calendar-weekdays" aria-hidden="true"><span>شنبه</span><span>یکشنبه</span><span>دوشنبه</span><span>سه‌شنبه</span><span>چهارشنبه</span><span>پنجشنبه</span><span>جمعه</span></div>
                                  <div class="calendar-grid" id="calendarDays" role="group" aria-label="فقط روزهای دارای نوبت آزاد"><div class="calendar-empty-note">در حال دریافت تقویم…</div></div>
                                  <div class="calendar-selected-date" id="selectedDateLabel" aria-live="polite">ابتدا یکی از روزهای قابل رزرو را انتخاب کنید.</div>
                                </div>
                                <input id="preferredSlot" name="preferredSlot" type="hidden" value="">
                              </div>
                              <div class="field full">
                                <label for="availableTime">ساعت‌های آزاد همان روز</label>
                                <select id="availableTime" required disabled><option value="">ابتدا یک روز قابل رزرو را انتخاب کنید</option></select>
                                <small class="field-help">فقط ساعت‌های آزاد همان روز قابل انتخاب هستند.</small>
                              </div>
                              <div class="field full"><div id="appointmentHint" class="booking-hint"></div><a id="appointmentPhoneLink" class="phone-link" href="tel:09961364434" hidden>تماس مستقیم با مطب · 09961364434</a></div>
                              <div class="field full"><label id="reasonLabel" for="reason">علت مراجعه</label><textarea id="reason" name="reason" maxlength="500" placeholder="در صورت تمایل، توضیح کوتاهی بنویسید"></textarea></div>
                            </div>
                            <button class="primary full-button" type="submit">ارسال درخواست نوبت</button><div class="form-message"></div>
                          </form>
                        </section>
            <section class="panel">
                          <div class="panel-heading"><h2>نوبت‌های من</h2><small>${appointments.length} مورد</small></div>
                          <div class="list">${appointments.length ? appointments.map(appointmentCard).join('') : '<div class="empty-card">هنوز درخواست نوبتی ثبت نشده است.</div>'}</div>
                        </section>
            <section class="panel study-panel">
                          <div class="panel-heading"><h2>مطالعه بیشتر</h2><small>آرشیو مقالات سایت رسمی</small></div>
                          <div class="study-grid">
                            <a class="study-card" href="https://mhsaffari.ir/articles-ms.html" target="_blank" rel="noopener"><span class="study-icon">MS</span><span><strong>آرشیو مقالات ام‌اس</strong><small>علائم، تشخیص و مسیرهای درمان و پیگیری</small></span><b>←</b></a>
                            <a class="study-card" href="https://mhsaffari.ir/articles-migraine-headache.html" target="_blank" rel="noopener"><span class="study-icon">✦</span><span><strong>آرشیو میگرن و سردرد</strong><small>آموزش‌های علمی درباره سردرد و درمان</small></span><b>←</b></a>
                            <a class="study-card" href="https://mhsaffari.ir/articles-neurology.html" target="_blank" rel="noopener"><span class="study-icon">＋</span><span><strong>آرشیو مغز و اعصاب</strong><small>مقالات عمومی نورولوژی و اختلالات عصبی</small></span><b>←</b></a>
                          </div>
                        </section>
          </div>
        </div>` : ''}
      `;
      bindCommon();
      bindPatientDiseaseForm(profile);
      if (active) bindPatientForms();
    } catch (error) {
      root.innerHTML = '<section class="panel"><h2>دریافت اطلاعات ناموفق بود</h2>' + messageBox(errorMessage(error),'error') + '<div class="card-actions"><button class="secondary" id="retryBtn">تلاش دوباره</button><button class="ghost-button" id="logoutBtn">خروج امن</button></div></section>';
      document.getElementById('retryBtn')?.addEventListener('click',loadDashboard);
      document.getElementById('logoutBtn')?.addEventListener('click',logout);
    }
  }
  let availabilityRequestSequence = 0;
  let bookingCalendar = {slotsByDate:Object.create(null),months:[],monthIndex:0,selectedDate:''};
  const calendarWeekOrder = ['شنبه','یکشنبه','دوشنبه','سه‌شنبه','چهارشنبه','پنجشنبه','جمعه'];

  function renderJalaliCalendar() {
    const monthLabel = document.getElementById('calendarMonthLabel');
    const daysGrid = document.getElementById('calendarDays');
    const previous = document.getElementById('calendarPrev');
    const next = document.getElementById('calendarNext');
    const selectedLabel = document.getElementById('selectedDateLabel');
    if (!monthLabel || !daysGrid) return;
    const months = bookingCalendar.months;
    if (!months.length) {
      monthLabel.textContent = 'زمانی برای رزرو موجود نیست';
      daysGrid.innerHTML = '<div class="calendar-empty-note">فعلاً روز قابل رزروی تعریف نشده است.</div>';
      if (previous) previous.disabled = true;
      if (next) next.disabled = true;
      if (selectedLabel) selectedLabel.textContent = 'با تعریف زمان‌های جدید، روزهای قابل رزرو در این تقویم نمایش داده می‌شوند.';
      return;
    }
    bookingCalendar.monthIndex = Math.min(Math.max(bookingCalendar.monthIndex,0),months.length-1);
    const month = months[bookingCalendar.monthIndex];
    const anchor = dateFromISO(month.firstDate);
    const anchorParts = jalaliDateParts(anchor);
    const firstDay = shiftDate(anchor,1-anchorParts.day);
    monthLabel.textContent = month.label;
    if (previous) previous.disabled = bookingCalendar.monthIndex <= 0;
    if (next) next.disabled = bookingCalendar.monthIndex >= months.length-1;

    const weekdayOffset = (firstDay.getDay()+1)%7;
    let daysCount = 0;
    for (let day=1;day<=31;day++) {
      const current = shiftDate(firstDay,day-1);
      const parts = jalaliDateParts(current);
      if (parts.year !== month.year || parts.month !== month.month) break;
      daysCount = day;
    }
    let html = '';
    for (let empty=0;empty<weekdayOffset;empty++) html += '<span class="calendar-day-empty" aria-hidden="true"></span>';
    for (let day=1;day<=daysCount;day++) {
      const dateIso = isoFromDate(shiftDate(firstDay,day-1));
      const available = bookingCalendar.slotsByDate[dateIso] || [];
      if (available.length) {
        const selected = bookingCalendar.selectedDate === dateIso;
        const dateLabel = jalaliFullDateFormatter.format(dateFromISO(dateIso));
        html += '<button type="button" class="calendar-day available' + (selected ? ' selected' : '') + '" data-calendar-date="' + h(dateIso) + '" aria-pressed="' + String(selected) + '" aria-label="' + h(dateLabel) + '">' +
          '<span>' + h(jalaliDayNumberFormatter.format(dateFromISO(dateIso))) + '</span><small>' + h(available.length) + ' زمان</small></button>';
      } else {
        // Keep the calendar layout aligned, but do not display unavailable dates or make them selectable.
        html += '<span class="calendar-day-empty" aria-hidden="true"></span>';
      }
    }
    while ((weekdayOffset+daysCount)%7 !== 0) { html += '<span class="calendar-day-empty" aria-hidden="true"></span>'; daysCount++; }
    daysGrid.innerHTML = html;
    if (selectedLabel && !bookingCalendar.selectedDate) selectedLabel.textContent = 'ابتدا یکی از روزهای دارای زمان آزاد را انتخاب کنید.';
    else if (selectedLabel && bookingCalendar.selectedDate) selectedLabel.textContent = jalaliFullDateFormatter.format(dateFromISO(bookingCalendar.selectedDate));
  }

  function setupJalaliCalendar(slots) {
    const byDate = Object.create(null);
    const byMonth = Object.create(null);
    const validSlots = (Array.isArray(slots) ? slots : []).filter(slot =>
      slot && /^\d{4}-\d{2}-\d{2}$/.test(String(slot.date || '')) && /^\d{2}:\d{2}/.test(String(slot.time || ''))
    ).map(slot => ({date:String(slot.date),time:String(slot.time)}))
      .sort((a,b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
    validSlots.forEach(slot => {
      if (!byDate[slot.date]) byDate[slot.date] = [];
      if (!byDate[slot.date].some(existing => existing.time === slot.time)) byDate[slot.date].push(slot);
      const parts = jalaliDateParts(dateFromISO(slot.date));
      if (!byMonth[parts.key]) {
        byMonth[parts.key] = {key:parts.key,year:parts.year,month:parts.month,label:jalaliMonthFormatter.format(dateFromISO(slot.date)),firstDate:slot.date};
      }
      if (slot.date < byMonth[parts.key].firstDate) byMonth[parts.key].firstDate = slot.date;
    });
    bookingCalendar = {
      slotsByDate:byDate,
      months:Object.values(byMonth).sort((a,b) => a.firstDate.localeCompare(b.firstDate)),
      monthIndex:0,
      selectedDate:''
    };
    const timeSelect = document.getElementById('availableTime');
    const slotInput = document.getElementById('preferredSlot');
    if (timeSelect) {
      timeSelect.disabled = true;
      timeSelect.innerHTML = '<option value="">ابتدا یک روز قابل رزرو را انتخاب کنید</option>';
    }
    if (slotInput) slotInput.value = '';
    renderJalaliCalendar();
  }

  async function refreshAvailableSlots(type) {
    const requestSequence = ++availabilityRequestSequence;
    const slotInput = document.getElementById('preferredSlot');
    const timeSelect = document.getElementById('availableTime');
    const hint = document.getElementById('appointmentHint');
    const phoneLink = document.getElementById('appointmentPhoneLink');
    const reason = document.getElementById('reason');
    const reasonLabel = document.getElementById('reasonLabel');
    if (!slotInput || !timeSelect) return;
    slotInput.value = '';
    timeSelect.disabled = true;
    timeSelect.innerHTML = '<option value="">در حال دریافت ساعت‌های آزاد…</option>';
    const monthLabel = document.getElementById('calendarMonthLabel');
    const daysGrid = document.getElementById('calendarDays');
    const selectedLabel = document.getElementById('selectedDateLabel');
    if (monthLabel) monthLabel.textContent = 'در حال دریافت زمان‌ها…';
    if (daysGrid) daysGrid.innerHTML = '<div class="calendar-empty-note">در حال دریافت تقویم…</div>';
    if (selectedLabel) selectedLabel.textContent = 'فقط روزهای قابل رزرو نمایش داده می‌شوند.';
    bookingCalendar = {slotsByDate:Object.create(null),months:[],monthIndex:0,selectedDate:''};
    if (reason) reason.required = type === 'in_person';
    if (phoneLink) phoneLink.hidden = type !== 'text';
    if (reasonLabel) reasonLabel.textContent = type === 'text' ? 'موضوع مشاوره (اختیاری)' : 'علت مراجعه';
    if (hint) hint.textContent = type === 'text'
      ? 'پس از ثبت درخواست، برای تأیید مشاوره با شماره مطب 09961364434 تماس بگیرید. پس از تأیید پزشک، پیوند شروع گفت‌وگو در ایتا در همین صفحه نمایش داده می‌شود.'
      : 'فقط زمان‌هایی نمایش داده می‌شوند که مطب برای نوبت حضوری باز کرده است. نوبت پس از تأیید مطب قطعی می‌شود.';
    try {
      const result = await api('/patients/availability?type=' + encodeURIComponent(type));
      if (requestSequence !== availabilityRequestSequence) return;
      const slots = result.slots || [];
      setupJalaliCalendar(slots);
      if (!slots.length && hint) hint.textContent += ' برای اطلاع از زمان‌های جدید با مطب تماس بگیرید.';
    } catch (error) {
      if (requestSequence !== availabilityRequestSequence) return;
      setupJalaliCalendar([]);
      if (hint) hint.textContent = errorMessage(error);
    }
  }

  function bindPatientForms() {
    const appointmentForm = document.getElementById('appointmentForm');
    const appointmentType = document.getElementById('appointmentType');
    const previousMonth = document.getElementById('calendarPrev');
    const nextMonth = document.getElementById('calendarNext');
    const daysGrid = document.getElementById('calendarDays');
    const timeSelect = document.getElementById('availableTime');
    const slotInput = document.getElementById('preferredSlot');
    if (previousMonth) previousMonth.addEventListener('click',() => {
      bookingCalendar.monthIndex = Math.max(0,bookingCalendar.monthIndex-1);
      renderJalaliCalendar();
    });
    if (nextMonth) nextMonth.addEventListener('click',() => {
      bookingCalendar.monthIndex = Math.min(bookingCalendar.months.length-1,bookingCalendar.monthIndex+1);
      renderJalaliCalendar();
    });
    if (daysGrid) daysGrid.addEventListener('click',event => {
      const dayButton = event.target.closest('[data-calendar-date]');
      if (!dayButton) return;
      const dateIso = dayButton.dataset.calendarDate;
      const freeTimes = bookingCalendar.slotsByDate[dateIso] || [];
      if (!freeTimes.length) return;
      bookingCalendar.selectedDate = dateIso;
      if (slotInput) slotInput.value = '';
      if (timeSelect) {
        timeSelect.innerHTML = '<option value="">ساعت را انتخاب کنید</option>' + freeTimes.map(slot =>
          '<option value="' + h(slot.time) + '">' + h(String(slot.time).slice(0,5)) + '</option>'
        ).join('');
        timeSelect.disabled = false;
        timeSelect.value = '';
      }
      renderJalaliCalendar();
    });
    if (timeSelect) timeSelect.addEventListener('change',() => {
      if (slotInput) slotInput.value = bookingCalendar.selectedDate && timeSelect.value
        ? bookingCalendar.selectedDate + '|' + timeSelect.value : '';
    });
    if (appointmentType) {
      appointmentType.addEventListener('change',() => refreshAvailableSlots(appointmentType.value));
      refreshAvailableSlots(appointmentType.value || 'in_person');
    }
    if (appointmentForm) appointmentForm.addEventListener('submit',async (event) => {
      event.preventDefault();
      const submit = appointmentForm.querySelector('button[type="submit"]');
      submit.disabled = true;
      const f = new FormData(appointmentForm);
      const type = String(f.get('appointmentType') || 'in_person');
      const slot = String(f.get('preferredSlot') || '').split('|');
      const reason = String(f.get('reason') || '').trim();
      if (slot.length !== 2 || !slot[0] || !slot[1]) {
        setMessage(appointmentForm,'لطفاً یک زمان قابل رزرو انتخاب کنید.','error'); submit.disabled = false; return;
      }
      if (type === 'in_person' && !reason) {
        setMessage(appointmentForm,'علت مراجعه را کوتاه بنویسید.','error'); submit.disabled = false; return;
      }
      try {
        await api('/patients/appointments','POST',{
          appointmentType:type,preferredDate:slot[0],preferredTime:slot[1],reason
        });
        await loadPatientDashboard();
        const updatedForm = document.getElementById('appointmentForm');
        if (updatedForm) setMessage(updatedForm,type === 'text'
          ? 'درخواست مشاوره متنی ثبت شد. لطفاً برای تأیید با شماره مطب 09961364434 تماس بگیرید. پس از تأیید پزشک، لینک گفت‌وگو در ایتا در همین صفحه ظاهر می‌شود.'
          : 'درخواست نوبت حضوری ثبت شد؛ تا تأیید مطب، نوبت قطعی نیست.','ok');
      } catch (e) {
        setMessage(appointmentForm,errorMessage(e),'error');
        submit.disabled = false;
      }
    });
    const reportForm = document.getElementById('reportForm');
    const reportTypeSelect=document.getElementById('reportType'),reportTypeButtons=Array.from(reportForm?.querySelectorAll('[data-report-type]')||[]),initialVisitFields=document.getElementById('initialVisitFields'),chiefComplaint=document.getElementById('initialMainConcern');
    const otherSymptomField=document.getElementById('otherSymptomField'),otherSymptomInput=document.getElementById('otherSymptom');
    const otherSymptomCheck=reportForm?.querySelector('input[name="symptoms"][value="other"]');
    reportForm?.querySelectorAll('input:not([type]),input[type="text"],textarea').forEach(input=>{input.maxLength=200;});
    const updateReportMode=()=>{const current=reportTypeSelect?.value||'symptom',initial=current==='initial_visit';if(initialVisitFields)initialVisitFields.hidden=!initial;if(chiefComplaint)chiefComplaint.required=Boolean(initial);if(initialVisitFields)initialVisitFields.querySelectorAll('input,textarea').forEach(input=>{if(input!==chiefComplaint)input.required=false;});reportTypeButtons.forEach(button=>{const selected=button.dataset.reportType===current;button.classList.toggle('active',selected);button.setAttribute('aria-pressed',selected?'true':'false');});};
    const updateOtherSymptom=()=>{const visible=Boolean(otherSymptomCheck?.checked);if(otherSymptomField)otherSymptomField.hidden=!visible;if(otherSymptomInput){otherSymptomInput.required=visible;if(!visible)otherSymptomInput.value='';}};
    reportTypeButtons.forEach(button=>button.addEventListener('click',()=>{if(reportTypeSelect)reportTypeSelect.value=button.dataset.reportType||'symptom';updateReportMode();}));
    otherSymptomCheck?.addEventListener('change',updateOtherSymptom);updateReportMode();updateOtherSymptom();
    if(reportForm)reportForm.addEventListener('submit',async event=>{
      event.preventDefault();const submit=reportForm.querySelector('button[type="submit"]');
      const f=new FormData(reportForm),reportType=String(f.get('reportType')||'symptom');
      let symptoms=f.getAll('symptoms').filter(value=>value!=='other').map(String);const customSymptom=String(f.get('otherSymptom')||'').trim();
      if(otherSymptomCheck?.checked&&!customSymptom){setMessage(reportForm,'لطفاً نام علامت دیگر را وارد کنید.','error');return;}
      if(otherSymptomCheck?.checked&&customSymptom)symptoms.push('سایر: '+customSymptom);
      const notesParts=[],extraNotes=String(f.get('notes')||'').trim();if(extraNotes)notesParts.push(extraNotes);
      if(reportType==='initial_visit'){
        const complaint=String(f.get('initialMainConcern')||'').trim();if(!complaint){setMessage(reportForm,'برای شرح حال اولیه، مشکل اصلی و علت مراجعه را بنویسید.','error');return;}
        const structured=[['مشکل اصلی',complaint],['زمان شروع',String(f.get('initialOnset')||'').trim()],['تشخیص قبلی',String(f.get('initialDiagnosis')||'').trim()],['داروهای فعلی',String(f.get('initialMedications')||'').trim()],['آزمایش و تصویربرداری قبلی',String(f.get('initialTests')||'').trim()],['بیماری زمینه‌ای یا حساسیت',String(f.get('initialHistory')||'').trim()]].filter(item=>item[1]).map(item=>item[0]+': '+item[1]);
        notesParts.unshift(...structured);
      }
      const notes=notesParts.join('\n');if(notes.length>2400){setMessage(reportForm,'شرح حال تلفیقی بیشتر از ۲۴۰۰ نویسه است؛ لطفاً کوتاه‌تر کنید.','error');return;}
      if(!symptoms.length&&!notes.trim()){setMessage(reportForm,'لطفاً دست‌کم یک علامت یا توضیح کوتاه وارد کنید.','error');return;}
      submit.disabled=true;
      try{await api('/patients/reports','POST',{reportType,severity:f.get('severity'),occurredOn:f.get('occurredOn'),symptoms,notes});setMessage(reportForm,'گزارش برای بررسی پزشک ثبت شد.','ok');await loadPatientDashboard();}
      catch(error){setMessage(reportForm,errorMessage(error),'error');submit.disabled=false;}
    });
  }
  function renderPatientRow(p) {
    const status = p.status || 'pending_review';
    return `<div class="patient-card">
      <div class="patient-top"><div><div class="patient-name">${h((p.firstName || '') + ' ' + (p.lastName || ''))}</div><div class="subline">${h(p.mobile || '')} · ${h(p.nationalId || '')}<br>${h(diseaseTitle(p.diseaseCode,p.customDiseaseLabel))}</div></div><span class="badge ${status === 'active' ? 'active' : (status === 'rejected' ? 'rejected' : 'pending')}">${h(statusTitle(status))}</span></div>
      <div class="card-actions">
        <button class="secondary" data-action="detail" data-id="${h(p.id)}">پرونده</button>
        ${status !== 'active' ? '<button class="primary" data-action="approve" data-id="' + h(p.id) + '">تأیید حساب</button>' : ''}
        ${status !== 'rejected' ? '<button class="danger-button" data-action="reject" data-id="' + h(p.id) + '">عدم تأیید</button>' : ''}
        <button class="danger-button" data-action="delete" data-id="${h(p.id)}" data-name="${h((p.firstName || '') + ' ' + (p.lastName || ''))}">حذف کامل حساب</button>
      </div>
    </div>`;
  }
  function renderDoctorAppointment(a) {
    const isText = a.appointmentType === 'text';
    return `<div class="appointment-card">
      <div class="appointment-top"><div><div class="patient-name">${h(a.patientName || 'بیمار')} · ${h(fmtDate(a.preferredDate))} · ${h(String(a.preferredTime || '').slice(0,5))}</div><span class="appt-type-label ${isText ? 'text' : 'in-person'}">${isText ? 'مشاوره متنی' : 'نوبت حضوری'}</span><div class="subline">${h(a.patientMobile || '')}</div><p style="line-height:1.9;white-space:pre-wrap;margin:9px 0 0">${h(a.reason || '')}</p></div><span class="badge ${h(a.status)}">${h(statusTitle(a.status))}</span></div>
      ${isText && a.status === 'requested' ? '<div class="consultation-notice">با تأیید درخواست، لینک ایتای پزشک در حساب بیمار نمایش داده می‌شود.</div>' : ''}
      <div class="card-actions">
        <button class="secondary" data-appt-patient="${h(a.patientId)}">پرونده و ثبت توصیه</button>
        ${a.status === 'requested' ? '<button class="primary" data-appt-status="confirmed" data-id="' + h(a.id) + '">تأیید نوبت / مشاوره</button><button class="danger-button" data-appt-status="rejected" data-id="' + h(a.id) + '">رد درخواست</button>' : ''}
        ${a.status === 'confirmed' ? '<button class="primary" data-appt-status="completed" data-id="' + h(a.id) + '">ویزیت شد</button><button class="ghost-button" data-appt-status="cancelled" data-id="' + h(a.id) + '">لغو نوبت</button>' : ''}
      </div>
    </div>`;
  }
  const weekdayNames = ['یکشنبه','دوشنبه','سه‌شنبه','چهارشنبه','پنجشنبه','جمعه','شنبه'];
  const weekdayOrder = [{label:'شنبه',value:6},{label:'یکشنبه',value:0},{label:'دوشنبه',value:1},{label:'سه‌شنبه',value:2},{label:'چهارشنبه',value:3},{label:'پنجشنبه',value:4},{label:'جمعه',value:5}];
  function renderAvailability(row) {
    const typeTitle = row.appointment_type === 'text' ? 'مشاوره متنی' : 'نوبت حضوری';
    return '<div class="availability-row"><div><strong>' + h(typeTitle) + ' · ' + h(weekdayNames[Number(row.day_of_week)] || '') + '</strong><small>' + h(String(row.start_time).slice(0,5)) + ' تا ' + h(String(row.end_time).slice(0,5)) + ' · هر نوبت ' + h(row.slot_minutes) + ' دقیقه</small></div><div class="availability-row-actions"><span class="badge ' + (row.is_active ? 'active' : 'cancelled') + '">' + (row.is_active ? 'فعال' : 'غیرفعال') + '</span><button type="button" class="ghost-button" data-availability-toggle="' + h(row.id) + '" data-active="' + String(row.is_active) + '">' + (row.is_active ? 'غیرفعال‌کردن' : 'فعال‌کردن') + '</button></div></div>';
  }
  function renderLeaveRow(row) {
    const typeTitle = row.appointment_type === 'in_person' ? 'فقط نوبت حضوری' : (row.appointment_type === 'text' ? 'فقط مشاوره متنی' : 'همه انواع نوبت');
    const start = jalaliFullDateFormatter.format(dateFromISO(String(row.start_date).slice(0,10)));
    const end = jalaliFullDateFormatter.format(dateFromISO(String(row.end_date).slice(0,10)));
    return '<div class="availability-row leave-row"><div><strong>' + h(start) + (row.start_date === row.end_date ? '' : ' تا ' + h(end)) + '</strong><small>' + h(typeTitle) + (row.reason ? ' · ' + h(row.reason) : '') + '</small></div><div class="availability-row-actions"><span class="badge ' + (row.is_active ? 'active' : 'cancelled') + '">' + (row.is_active ? 'فعال' : 'غیرفعال') + '</span><button type="button" class="ghost-button" data-leave-toggle="' + h(row.id) + '" data-active="' + String(row.is_active) + '">' + (row.is_active ? 'غیرفعال‌کردن' : 'فعال‌کردن') + '</button></div></div>';
  }
  async function loadDoctorDashboard() {
    root.innerHTML = '<section class="loading-card"><div class="spinner"></div><p>در حال دریافت اطلاعات سرور…</p></section>';
    try {
      const values = await Promise.all([api('/doctor/patients'),api('/doctor/appointments'),api('/doctor/availability'),api('/doctor/leaves')]);
      const patients = values[0].patients || [];
      const appointments = values[1].appointments || [];
      const availability = values[2].availability || [];
      const leaves = values[3].leaves || [];
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
          <section class="panel patient-directory-panel">
            <div class="panel-heading"><h2>بیماران</h2><small id="patientsCount">${patients.length} مورد</small></div>
            <div class="field patient-search-field"><label for="patientSearchInput">جستجوی بیمار</label><input id="patientSearchInput" type="search" autocomplete="off" placeholder="نام، نام خانوادگی، موبایل یا کد ملی"><small class="hint">برای یافتن بیمار می‌توانید بخشی از هر مشخصه را وارد کنید.</small></div>
            <div class="list" id="patientsList">${patients.length ? patients.map(renderPatientRow).join('') : '<div class="empty-card">هنوز بیماری در سرور ثبت نشده است. پس از ثبت‌نام بیمار، این فهرست به‌روزرسانی می‌شود.</div>'}</div>
          </section>
          <div class="stack">
            <section class="panel">
              <div class="panel-heading"><h2>درخواست‌های نوبت و نوبت‌های آینده</h2><small>${appointments.length} مورد</small></div>
              <div class="list" id="appointmentsList">${appointments.length ? appointments.map(renderDoctorAppointment).join('') : '<div class="empty-card">در حال حاضر درخواست باز یا نوبت آینده‌ای وجود ندارد.</div>'}</div>
            </section>
            <section class="panel">
              <div class="panel-heading"><h2>نکته مهم</h2></div>
              <p class="lead" style="margin:0;font-size:14px">این پنل فقط اطلاعات ذخیره‌شده در سرور را نمایش می‌دهد. تصمیم‌گیری درباره تشخیص یا تغییر درمان باید توسط پزشک انجام شود.</p>
            </section>
          </div>
        </div>
        <section class="panel availability-panel">
          <div class="panel-heading"><h2>تعریف زمان‌های نوبت‌گیری</h2><small>برنامه هفتگی برای هر نوع نوبت</small></div>
          <form id="availabilityForm">
            <div class="form-grid">
              <div class="field"><label for="availabilityType">نوع نوبت</label><select id="availabilityType" name="appointmentType"><option value="in_person">حضوری در مطب</option><option value="text">مشاوره متنی</option></select></div>
              <div class="field"><label for="availabilityDay">روز هفته</label><select id="availabilityDay" name="dayOfWeek">${weekdayOrder.map(d=>'<option value="'+d.value+'">'+h(d.label)+'</option>').join('')}</select></div>
              <div class="field"><label for="availabilityStart">از ساعت</label><input id="availabilityStart" name="startTime" type="time" value="09:00" required></div>
              <div class="field"><label for="availabilityEnd">تا ساعت</label><input id="availabilityEnd" name="endTime" type="time" value="12:00" required></div>
              <div class="field"><label for="availabilityDuration">مدت هر نوبت</label><select id="availabilityDuration" name="slotMinutes"><option value="15">۱۵ دقیقه</option><option value="20">۲۰ دقیقه</option><option value="30" selected>۳۰ دقیقه</option><option value="45">۴۵ دقیقه</option><option value="60">۶۰ دقیقه</option></select></div>
            </div>
            <button class="primary full-button" type="submit">ذخیره زمان‌بندی</button><div class="form-message"></div>
          </form>
          <div class="availability-list" id="availabilityList">${availability.length ? availability.map(renderAvailability).join('') : '<div class="empty-card">هنوز زمان‌بندی‌ای تعریف نشده است.</div>'}</div>
        </section>
        <section class="panel leave-panel">
          <div class="panel-heading"><h2>مرخصی و عدم پذیرش نوبت</h2><small>تعریف بازه‌ای</small></div>
          <p class="hint leave-hint">در بازه مرخصی، سامانه هیچ زمان جدیدی برای نوع نوبت انتخاب‌شده پیشنهاد نمی‌کند. نوبت‌های قبلی خودکار لغو نمی‌شوند و باید جداگانه بررسی شوند.</p>
          <form id="leaveForm">
            <div class="form-grid">
              <div class="field"><label for="leaveStartDate">شروع مرخصی</label><input id="leaveStartDate" name="startDate" type="date" required></div>
              <div class="field"><label for="leaveEndDate">پایان مرخصی</label><input id="leaveEndDate" name="endDate" type="date" required></div>
              <div class="field"><label for="leaveType">نوع نوبت</label><select id="leaveType" name="appointmentType"><option value="">همه انواع نوبت</option><option value="in_person">فقط نوبت حضوری</option><option value="text">فقط مشاوره متنی</option></select></div>
              <div class="field"><label for="leaveReason">توضیح (اختیاری)</label><input id="leaveReason" name="reason" maxlength="300" placeholder="مثلاً مرخصی یا همایش"></div>
            </div>
            <button class="primary full-button" type="submit">ثبت بازه مرخصی</button><div class="form-message"></div>
          </form>
          <div class="availability-list" id="leaveList">${leaves.length ? leaves.map(renderLeaveRow).join('') : '<div class="empty-card">هنوز بازه مرخصی ثبت نشده است.</div>'}</div>
        </section>`;
      bindCommon();
      const availabilityForm = document.getElementById('availabilityForm');
      availabilityForm?.addEventListener('submit',async e => {
        e.preventDefault();
        const button = availabilityForm.querySelector('button[type="submit"]');
        button.disabled = true;
        const f = new FormData(availabilityForm);
        try {
          await api('/doctor/availability','POST',{appointmentType:f.get('appointmentType'),dayOfWeek:Number(f.get('dayOfWeek')),startTime:f.get('startTime'),endTime:f.get('endTime'),slotMinutes:Number(f.get('slotMinutes'))});
          await loadDoctorDashboard();
        } catch (error) { setMessage(availabilityForm,errorMessage(error),'error'); button.disabled = false; }
      });
      root.querySelectorAll('[data-availability-toggle]').forEach(btn => btn.addEventListener('click',async () => {
        try {
          await api('/doctor/availability/' + encodeURIComponent(btn.dataset.availabilityToggle),'PATCH',{isActive:btn.dataset.active !== 'true'});
          await loadDoctorDashboard();
        } catch(error) { alert(errorMessage(error)); }
      }));
      root.querySelectorAll('[data-leave-toggle]').forEach(btn => btn.addEventListener('click',async () => {
        try {
          await api('/doctor/leaves/' + encodeURIComponent(btn.dataset.leaveToggle),'PATCH',{isActive:btn.dataset.active !== 'true'});
          await loadDoctorDashboard();
        } catch(error) { alert(errorMessage(error)); }
      }));
      const leaveForm = document.getElementById('leaveForm');
      leaveForm?.addEventListener('submit',async e => {
        e.preventDefault();
        const button=leaveForm.querySelector('button[type="submit"]');button.disabled=true;
        const f=new FormData(leaveForm);
        if(String(f.get('endDate')||'')<String(f.get('startDate')||'')){setMessage(leaveForm,'تاریخ پایان باید هم‌روز یا بعد از تاریخ شروع باشد.','error');button.disabled=false;return;}
        try{
          await api('/doctor/leaves','POST',{startDate:f.get('startDate'),endDate:f.get('endDate'),appointmentType:f.get('appointmentType'),reason:f.get('reason')});
          await loadDoctorDashboard();
        }catch(error){setMessage(leaveForm,errorMessage(error),'error');button.disabled=false;}
      });
      let patientSearchTimer;
      const patientSearchInput=document.getElementById('patientSearchInput');
      patientSearchInput?.addEventListener('input',()=>{
        clearTimeout(patientSearchTimer);
        const query=patientSearchInput.value.trim();
        patientSearchTimer=setTimeout(async()=>{
          const list=document.getElementById('patientsList'),count=document.getElementById('patientsCount');
          if(!list)return;
          list.innerHTML='<div class="empty-card">در حال جستجو…</div>';
          try{
            const result=await api('/doctor/patients'+(query?'?q='+encodeURIComponent(query):''));
            const matches=result.patients||[];
            list.innerHTML=matches.length?matches.map(renderPatientRow).join(''):'<div class="empty-card">بیماری با این مشخصات پیدا نشد.</div>';
            if(count)count.textContent=String(matches.length)+' مورد';
          }catch(error){list.innerHTML='<div class="empty-card">'+h(errorMessage(error))+'</div>';}
        },250);
      });
      document.getElementById('patientsList')?.addEventListener('click',async event=>{
        const btn=event.target instanceof Element ? event.target.closest('[data-action]') : null;
        if(!btn)return;
        const id=btn.dataset.id,action=btn.dataset.action;
        try{
          if(action==='detail')return loadDoctorPatient(id);
          if(action==='delete'){
            const name=btn.dataset.name||'این بیمار';
            if(!confirm('حذف کامل حساب '+name+'؟ همه نوبت‌ها، گزارش‌ها، یادداشت‌ها و برنامه‌های وابسته حذف می‌شوند و این کار قابل بازگشت نیست.'))return;
            if(!confirm('برای آزادشدن کد ملی و موبایل و امکان ثبت‌نام مجدد، حساب بیمار و پرونده وابسته کاملاً حذف شود؟'))return;
            await api('/doctor/patients/'+encodeURIComponent(id),'DELETE');
            await loadDoctorDashboard();
            return;
          }
          const status=action==='approve'?'active':'rejected';
          if(!confirm(status==='active'?'حساب این بیمار تأیید شود؟':'ثبت‌نام این بیمار تأیید نشود؟'))return;
          await api('/doctor/patients/'+encodeURIComponent(id)+'/status','PATCH',{status});
          await loadDoctorDashboard();
        }catch(error){alert(errorMessage(error));}
      });
      root.querySelectorAll('[data-appt-patient]').forEach(btn=>btn.addEventListener('click',()=>loadDoctorPatient(btn.dataset.apptPatient)));
      root.querySelectorAll('[data-appt-status]').forEach(btn => btn.addEventListener('click',async () => {
        try {
          if(btn.dataset.apptStatus==='completed'&&!confirm('آیا این بیمار ویزیت شد؟ در صورت نیاز، ابتدا «پرونده و ثبت توصیه» را باز کنید و توصیه‌های لازم را ثبت کنید.'))return;
          let doctorNote = '';
          if (btn.dataset.apptStatus === 'rejected') doctorNote = prompt('پیام کوتاه برای بیمار (اختیاری):','') || '';
          await api('/doctor/appointments/' + encodeURIComponent(btn.dataset.id) + '/status','PATCH',{status:btn.dataset.apptStatus,doctorNote});
          await loadDoctorDashboard();
        } catch (e) { alert(errorMessage(e)); }
      }));    } catch (error) {
      root.innerHTML = '<section class="panel"><h2>اتصال پنل پزشک برقرار نشد</h2>' + messageBox(errorMessage(error),'error') + '<div class="card-actions"><button class="secondary" id="retryBtn">تلاش دوباره</button><button class="ghost-button" id="logoutBtn">خروج امن</button></div></section>';
      document.getElementById('retryBtn')?.addEventListener('click',loadDashboard);
      document.getElementById('logoutBtn')?.addEventListener('click',logout);
    }
  }

  async function loadDoctorPatient(id) {
    root.innerHTML = '<section class="loading-card"><div class="spinner"></div><p>در حال دریافت پرونده و سوابق بیمار…</p></section>';
    try {
      const values = await Promise.all([
        api('/doctor/patients/' + encodeURIComponent(id)),
        api('/doctor/patients/' + encodeURIComponent(id) + '/reports'),
        api('/doctor/patients/' + encodeURIComponent(id) + '/notes'),
        api('/doctor/patients/' + encodeURIComponent(id) + '/appointments'),
        api('/doctor/patients/' + encodeURIComponent(id) + '/treatment-plan'),
        api('/doctor/patients/' + encodeURIComponent(id) + '/medications')
      ]);
      const p = values[0].patient;
      const reports = values[1].reports || [];
      const notes = values[2].notes || [];
      const appointments = values[3].appointments || [];
      const plans = values[4].plans || [];
      const medications = values[5].medications || [];
      currentPatient = p;
      root.innerHTML = `
        <div class="dash-head"><div><h1>پرونده بیمار</h1><p>${h((p.firstName || '') + ' ' + (p.lastName || ''))} · ${h(diseaseTitle(p.diseaseCode,p.customDiseaseLabel))}</p></div><div class="head-actions"><button class="ghost-button" id="backBtn">بازگشت</button><button class="secondary" id="logoutBtn">خروج امن</button></div></div>
        <div class="metrics">${metric('وضعیت حساب',statusTitle(p.status))}${metric('شماره تماس',p.mobile || '—')}${metric('کد ملی',p.nationalId || '—')}${metric('تاریخ ثبت',fmtDate(p.createdAt))}</div>
        <div class="content-grid">
          <div class="stack">
            <section class="panel"><div class="panel-heading"><h2>گزارش‌های بیمار</h2><small>${reports.length} مورد</small></div>
              <div class="row-list">${reports.length ? reports.map(r => '<div class="row-item"><div><strong>' + h(statusTitle(r.report_type)) + ' · شدت ' + h(r.severity ?? '—') + '</strong><p>' + h([...(Array.isArray(r.symptoms)?r.symptoms:[]),r.notes].filter(Boolean).join('، ')) + '</p></div><div class="card-actions"><small class="subline">' + h(fmtDate(r.submitted_at)) + '</small><button type="button" class="danger-button" data-delete-record="reports" data-record-id="' + h(r.id) + '">حذف سابقه</button></div></div>').join('') : '<div class="empty-card">گزارشی ثبت نشده است.</div>'}</div>
            </section>
            <section class="panel"><div class="panel-heading"><h2>سوابق نوبت‌ها و ویزیت‌ها</h2><small>${appointments.length} مورد</small></div>
              <div class="row-list">${appointments.length ? appointments.map(a => '<div class="row-item"><div><strong>' + h(fmtDate(a.preferred_date)) + ' · ' + h(String(a.preferred_time || '').slice(0,5)) + '</strong><p>' + h(a.appointment_type === 'text' ? 'مشاوره متنی' : 'نوبت حضوری') + ' · ' + h(statusTitle(a.status)) + '</p><p>' + h(a.reason || '') + (a.doctor_note ? '<br>یادداشت: ' + h(a.doctor_note) : '') + '</p></div><div class="card-actions"><button type="button" class="danger-button" data-delete-record="appointments" data-record-id="' + h(a.id) + '">حذف سابقه</button></div></div>').join('') : '<div class="empty-card">سابقه نوبتی ثبت نشده است.</div>'}</div>
            </section>
            <section class="panel"><div class="panel-heading"><h2>یادداشت‌های بالینی</h2><small>${notes.length} مورد</small></div>
              <div class="row-list">${notes.length ? notes.map(n => '<div class="row-item"><div><strong>' + h(n.visible_to_patient ? 'قابل مشاهده برای بیمار' : 'یادداشت داخلی') + '</strong><p>' + h(n.note_text) + '</p></div><div class="card-actions"><small class="subline">' + h(fmtDate(n.created_at)) + '</small><button type="button" class="danger-button" data-delete-record="notes" data-record-id="' + h(n.id) + '">حذف سابقه</button></div></div>').join('') : '<div class="empty-card">یادداشتی ثبت نشده است.</div>'}</div>
              <form id="noteForm" class="form-section"><h3>ثبت یادداشت جدید</h3><div class="field"><label for="noteText">متن یادداشت</label><textarea id="noteText" name="noteText" required minlength="3" maxlength="5000"></textarea></div><label class="chip" style="margin-top:10px"><input type="checkbox" name="visibleToPatient"> این یادداشت در پنل بیمار نمایش داده شود</label><button class="primary full-button" type="submit">ذخیره یادداشت</button><div class="form-message"></div></form>
            </section>
          </div>
          <div class="stack">
            <section class="panel"><div class="panel-heading"><h2>سوابق برنامه‌های پیگیری</h2><small>${plans.length} مورد</small></div>
              <div class="row-list">${plans.length ? plans.map(pn => '<div class="row-item"><div><strong>' + h(pn.title) + ' · ' + h(pn.active ? 'فعال' : 'غیرفعال') + '</strong><p>' + h(pn.instructions) + '</p><small class="subline">تاریخ پیگیری: ' + h(pn.follow_up_date || '—') + ' · ' + h(fmtDate(pn.created_at)) + '</small></div><div class="card-actions"><button type="button" class="danger-button" data-delete-record="treatment-plan" data-record-id="' + h(pn.id) + '">حذف سابقه</button></div></div>').join('') : '<div class="empty-card">برنامه‌ای ثبت نشده است.</div>'}</div>
            </section>
            <section class="panel"><div class="panel-heading"><h2>ثبت برنامه پیگیری</h2></div>
              <form id="planForm"><div class="field"><label for="planTitle">عنوان</label><input id="planTitle" name="title" required maxlength="200"></div><div class="field" style="margin-top:12px"><label for="planInstructions">توصیه و برنامه ثبت‌شده توسط پزشک</label><textarea id="planInstructions" name="instructions" required maxlength="4000"></textarea></div><div class="field" style="margin-top:12px"><label for="followUpDate">تاریخ پیگیری (اختیاری)</label><input id="followUpDate" name="followUpDate" type="date"></div><button class="primary full-button" type="submit">ذخیره برنامه پیگیری</button><div class="form-message"></div></form>
            </section>
            <section class="panel"><div class="panel-heading"><h2>سوابق داروها</h2><small>${medications.length} مورد</small></div>
              <div class="row-list">${medications.length ? medications.map(m => '<div class="row-item"><div><strong>' + h(m.name) + ' · ' + h(m.dose || 'دوز ثبت نشده') + '</strong><p>' + h(m.instructions || '') + '</p><small class="subline">' + h(m.active ? 'فعال' : 'غیرفعال') + ' · ' + h(fmtDate(m.created_at)) + '</small></div><div class="card-actions"><button type="button" class="danger-button" data-delete-record="medications" data-record-id="' + h(m.id) + '">حذف سابقه</button></div></div>').join('') : '<div class="empty-card">دارویی ثبت نشده است.</div>'}</div>
            </section>
            <section class="panel"><div class="panel-heading"><h2>ثبت دارو</h2><small>طبق تصمیم پزشک</small></div>
              <form id="medForm"><div class="field"><label for="medName">نام دارو</label><input id="medName" name="name" required maxlength="200"></div><div class="field" style="margin-top:12px"><label for="medDose">دوز / مقدار</label><input id="medDose" name="dose" required maxlength="200"></div><div class="field" style="margin-top:12px"><label for="medInstructions">نحوه مصرف و توضیحات</label><textarea id="medInstructions" name="instructions" maxlength="1000"></textarea></div><button class="primary full-button" type="submit">ثبت دارو</button><div class="form-message"></div></form>
            </section>
          </div>
        </div>`;
      document.getElementById('backBtn')?.addEventListener('click',loadDoctorDashboard);
      document.getElementById('logoutBtn')?.addEventListener('click',logout);
      bindDoctorPatientForms(id);
      root.querySelectorAll('[data-delete-record]').forEach(btn => btn.addEventListener('click', async () => {
        const type = btn.dataset.deleteRecord;
        const recordId = btn.dataset.recordId;
        if (!confirm('این سابقه از پرونده بیمار به‌صورت دائمی حذف شود؟ این کار قابل بازگشت نیست.')) return;
        try {
          await api('/doctor/patients/' + encodeURIComponent(id) + '/' + encodeURIComponent(type) + '/' + encodeURIComponent(recordId),'DELETE');
          await loadDoctorPatient(id);
        } catch (error) { alert(errorMessage(error)); }
      }));
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
  let deferredInstallPrompt = null;
  const installAppBtn = document.getElementById('installAppBtn');
  window.addEventListener('beforeinstallprompt',event => {
    event.preventDefault();
    deferredInstallPrompt = event;
    if (installAppBtn) installAppBtn.textContent = 'نصب نرم‌افزار';
  });
  if (installAppBtn) {
    const alreadyInstalled = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
    if (alreadyInstalled) { installAppBtn.textContent = 'نصب شده'; installAppBtn.disabled = true; }
    installAppBtn.addEventListener('click',async () => {
      if (alreadyInstalled) return;
      if (deferredInstallPrompt) {
        deferredInstallPrompt.prompt();
        await deferredInstallPrompt.userChoice;
        deferredInstallPrompt = null;
      } else if (/iphone|ipad|ipod/i.test(navigator.userAgent)) {
        alert('برای نصب روی آیفون، در Safari دکمه Share را بزنید و گزینه Add to Home Screen را انتخاب کنید.');
      } else {
        alert('از منوی مرورگر گزینه «نصب برنامه» یا «افزودن به صفحه اصلی» را انتخاب کنید.');
      }
    });
  }
  window.addEventListener('appinstalled',() => { if (installAppBtn) { installAppBtn.textContent = 'نصب شده'; installAppBtn.disabled = true; } });
  document.querySelectorAll('[data-open-register]').forEach(link => link.addEventListener('click',event => {
    event.preventDefault();
    showLogin(APP_ROLE,'register');
    requestAnimationFrame(() => document.querySelector('#app .auth-card')?.scrollIntoView({behavior:'smooth',block:'center'}));
  }));
  document.querySelectorAll('[data-open-login]').forEach(link => link.addEventListener('click',event => {
    event.preventDefault();
    showLogin(APP_ROLE,'login');
    document.getElementById('app')?.scrollIntoView({behavior:'smooth',block:'start'});
  }));
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
  }
  if (token && role) loadDashboard(); else showLogin('patient','login');  if (token && role) loadDashboard(); else showLogin('patient','login');
})();