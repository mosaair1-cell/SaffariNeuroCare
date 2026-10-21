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
    ['low_back_pain','کمردرد'],
    ['stroke','سکته مغزی'],
    ['other','سایر'],
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
    report_notes_too_long:'توضیحات علائم حداکثر ۲۰۰ نویسه می‌تواند باشد.',
    slot_unavailable:'این زمان همین حالا رزرو شده یا دیگر قابل انتخاب نیست؛ زمان دیگری را انتخاب کنید.',
    invalid_availability:'روز یا ساعت کاری واردشده معتبر نیست.',
    availability_not_found:'بازه زمانی موردنظر پیدا نشد.'
  };
  const h = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const normalizeDigits = (value) => String(value == null ? '' : value)
    .replace(/[۰-۹]/g, c => String(c.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, c => String(c.charCodeAt(0) - 0x0660));
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
              <div class="field full"><label for="diseaseCode">حوزه پیگیری</label><select id="diseaseCode" name="diseaseCode">${diseases.map(d => '<option value="' + h(d[0]) + '">' + h(d[1]) + '</option>').join('')}</select></div>
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
      ${isText && a.status === 'requested' ? '<div class="consultation-notice">برای تأیید درخواست مشاوره متنی، با شماره مطب <strong>09961364434</strong> تماس بگیرید.</div>' : ''}
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
                  <div class="field full"><label for="appointmentType">نوع نوبت</label><select id="appointmentType" name="appointmentType"><option value="in_person">نوبت حضوری در مطب</option><option value="text">مشاوره متنی</option></select></div>
                  <div class="field full"><label for="preferredSlot">روز و ساعت قابل رزرو</label><select id="preferredSlot" name="preferredSlot" required><option value="">در حال دریافت زمان‌های قابل رزرو…</option></select></div>
                  <div class="field full"><div id="appointmentHint" class="booking-hint"></div></div>
                  <div class="field full"><label id="reasonLabel" for="reason">علت مراجعه</label><textarea id="reason" name="reason" maxlength="500" placeholder="در صورت تمایل، توضیح کوتاهی بنویسید"></textarea></div>
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
                <div class="field full"><label>علائم اخیر (چند مورد قابل انتخاب است)</label><div class="symptom-options">
                  <label class="symptom-chip"><input type="checkbox" name="symptoms" value="headache"><span>سردرد</span></label>
                  <label class="symptom-chip"><input type="checkbox" name="symptoms" value="fatigue"><span>خستگی</span></label>
                  <label class="symptom-chip"><input type="checkbox" name="symptoms" value="numbness"><span>گزگز / بی‌حسی</span></label>
                  <label class="symptom-chip"><input type="checkbox" name="symptoms" value="vision"><span>مشکل بینایی</span></label>
                  <label class="symptom-chip"><input type="checkbox" name="symptoms" value="balance"><span>اختلال تعادل</span></label>
                  <label class="symptom-chip"><input type="checkbox" name="symptoms" value="sleep"><span>اختلال خواب</span></label>
                </div></div>
                <div class="form-grid" style="margin-top:14px">
                  <div class="field"><label for="severity">شدت کلی (۱ تا ۱۰)</label><input id="severity" type="number" name="severity" min="1" max="10" value="3"></div>
                  <div class="field"><label for="occurredOn">تاریخ گزارش</label><input id="occurredOn" type="date" name="occurredOn" value="${new Date().toISOString().slice(0,10)}"></div>
                  <div class="field full"><label for="reportNotes">توضیحات (حداکثر ۲۰۰ نویسه)</label><textarea id="reportNotes" name="notes" maxlength="200" placeholder="زمان شروع، مدت و تغییر علائم را کوتاه بنویسید"></textarea><small class="field-help">برای اطلاعات ضروری؛ حداکثر ۲۰۰ نویسه.</small></div>
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
            <section class="panel study-panel">
              <div class="panel-heading"><h2>مطالعه بیشتر</h2><small>آرشیو مقالات سایت رسمی</small></div>
              <div class="study-grid">
                <a class="study-card" href="https://mhsaffari.ir/articles/ms/" target="_blank" rel="noopener"><span class="study-icon">MS</span><span><strong>آرشیو مقالات ام‌اس</strong><small>علائم، تشخیص و مسیرهای درمان و پیگیری</small></span><b>←</b></a>
                <a class="study-card" href="https://mhsaffari.ir/articles/migraine/" target="_blank" rel="noopener"><span class="study-icon">✦</span><span><strong>آرشیو میگرن و سردرد</strong><small>آموزش‌های علمی درباره سردرد و درمان</small></span><b>←</b></a>
                <a class="study-card" href="https://mhsaffari.ir/articles/neurology/" target="_blank" rel="noopener"><span class="study-icon">＋</span><span><strong>آرشیو مغز و اعصاب</strong><small>مقالات عمومی نورولوژی و اختلالات عصبی</small></span><b>←</b></a>
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
  async function refreshAvailableSlots(type) {
    const select = document.getElementById('preferredSlot');
    const hint = document.getElementById('appointmentHint');
    const reason = document.getElementById('reason');
    const reasonLabel = document.getElementById('reasonLabel');
    if (!select) return;
    select.innerHTML = '<option value="">در حال دریافت زمان‌ها…</option>';
    if (reason) reason.required = type === 'in_person';
    if (reasonLabel) reasonLabel.textContent = type === 'text' ? 'موضوع مشاوره (اختیاری)' : 'علت مراجعه';
    if (hint) hint.textContent = type === 'text'
      ? 'پس از ثبت درخواست، برای تأیید مشاوره با شماره مطب 09961364434 تماس بگیرید. پس از تأیید پزشک، پیوند شروع گفت‌وگو در ایتا در همین صفحه نمایش داده می‌شود.'
      : 'فقط زمان‌هایی نمایش داده می‌شوند که مطب برای نوبت حضوری باز کرده است. نوبت پس از تأیید مطب قطعی می‌شود.';
    try {
      const result = await api('/patients/availability?type=' + encodeURIComponent(type));
      const slots = result.slots || [];
      select.innerHTML = slots.length
        ? slots.map(slot => '<option value="' + h(slot.date) + '|' + h(slot.time) + '">' + h(fmtDate(slot.date)) + ' · ' + h(slot.time) + '</option>').join('')
        : '<option value="">فعلاً زمانی برای رزرو تعریف نشده است</option>';
      if (!slots.length && hint) hint.textContent += ' برای اطلاع از زمان‌های جدید با مطب تماس بگیرید.';
    } catch (error) {
      select.innerHTML = '<option value="">دریافت زمان‌ها ناموفق بود</option>';
      if (hint) hint.textContent = errorMessage(error);
    }
  }
  function bindPatientForms() {
    const appointmentForm = document.getElementById('appointmentForm');
    const appointmentType = document.getElementById('appointmentType');
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
    const isText = a.appointmentType === 'text';
    return `<div class="appointment-card">
      <div class="appointment-top"><div><div class="patient-name">${h(a.patientName || 'بیمار')} · ${h(fmtDate(a.preferredDate))} · ${h(String(a.preferredTime || '').slice(0,5))}</div><span class="appt-type-label ${isText ? 'text' : 'in-person'}">${isText ? 'مشاوره متنی' : 'نوبت حضوری'}</span><div class="subline">${h(a.patientMobile || '')}</div><p style="line-height:1.9;white-space:pre-wrap;margin:9px 0 0">${h(a.reason || '')}</p></div><span class="badge ${h(a.status)}">${h(statusTitle(a.status))}</span></div>
      ${isText && a.status === 'requested' ? '<div class="consultation-notice">با تأیید درخواست، لینک ایتای پزشک در حساب بیمار نمایش داده می‌شود.</div>' : ''}
      <div class="card-actions">
        ${a.status === 'requested' ? '<button class="primary" data-appt-status="confirmed" data-id="' + h(a.id) + '">تأیید نوبت / مشاوره</button><button class="danger-button" data-appt-status="rejected" data-id="' + h(a.id) + '">رد درخواست</button>' : ''}
        ${a.status === 'confirmed' ? '<button class="secondary" data-appt-status="completed" data-id="' + h(a.id) + '">ثبت انجام ویزیت</button><button class="ghost-button" data-appt-status="cancelled" data-id="' + h(a.id) + '">لغو نوبت</button>' : ''}
      </div>
    </div>`;
  }
  const weekdayNames = ['یکشنبه','دوشنبه','سه‌شنبه','چهارشنبه','پنجشنبه','جمعه','شنبه'];
  function renderAvailability(row) {
    const typeTitle = row.appointment_type === 'text' ? 'مشاوره متنی' : 'نوبت حضوری';
    return '<div class="availability-row"><div><strong>' + h(typeTitle) + ' · ' + h(weekdayNames[Number(row.day_of_week)] || '') + '</strong><small>' + h(String(row.start_time).slice(0,5)) + ' تا ' + h(String(row.end_time).slice(0,5)) + ' · هر نوبت ' + h(row.slot_minutes) + ' دقیقه</small></div><div class="availability-row-actions"><span class="badge ' + (row.is_active ? 'active' : 'cancelled') + '">' + (row.is_active ? 'فعال' : 'غیرفعال') + '</span><button type="button" class="ghost-button" data-availability-toggle="' + h(row.id) + '" data-active="' + String(row.is_active) + '">' + (row.is_active ? 'غیرفعال‌کردن' : 'فعال‌کردن') + '</button></div></div>';
  }
  async function loadDoctorDashboard() {
    root.innerHTML = '<section class="loading-card"><div class="spinner"></div><p>در حال دریافت اطلاعات سرور…</p></section>';
    try {
      const values = await Promise.all([api('/doctor/patients'),api('/doctor/appointments'),api('/doctor/availability')]);
      const patients = values[0].patients || [];
      const appointments = values[1].appointments || [];
      const availability = values[2].availability || [];
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
        </div>
        <section class="panel availability-panel">
          <div class="panel-heading"><h2>تعریف زمان‌های نوبت‌گیری</h2><small>برنامه هفتگی برای هر نوع نوبت</small></div>
          <form id="availabilityForm">
            <div class="form-grid">
              <div class="field"><label for="availabilityType">نوع نوبت</label><select id="availabilityType" name="appointmentType"><option value="in_person">حضوری در مطب</option><option value="text">مشاوره متنی</option></select></div>
              <div class="field"><label for="availabilityDay">روز هفته</label><select id="availabilityDay" name="dayOfWeek">${weekdayNames.map((d,i)=>'<option value="'+i+'">'+h(d)+'</option>').join('')}</select></div>
              <div class="field"><label for="availabilityStart">از ساعت</label><input id="availabilityStart" name="startTime" type="time" value="09:00" required></div>
              <div class="field"><label for="availabilityEnd">تا ساعت</label><input id="availabilityEnd" name="endTime" type="time" value="12:00" required></div>
              <div class="field"><label for="availabilityDuration">مدت هر نوبت</label><select id="availabilityDuration" name="slotMinutes"><option value="15">۱۵ دقیقه</option><option value="20">۲۰ دقیقه</option><option value="30" selected>۳۰ دقیقه</option><option value="45">۴۵ دقیقه</option><option value="60">۶۰ دقیقه</option></select></div>
            </div>
            <button class="primary full-button" type="submit">ذخیره زمان‌بندی</button><div class="form-message"></div>
          </form>
          <div class="availability-list" id="availabilityList">${availability.length ? availability.map(renderAvailability).join('') : '<div class="empty-card">هنوز زمان‌بندی‌ای تعریف نشده است.</div>'}</div>
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
    document.getElementById('app')?.scrollIntoView({behavior:'smooth',block:'start'});
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