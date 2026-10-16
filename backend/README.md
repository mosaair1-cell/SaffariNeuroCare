# Saffari NeuroCare — راهنمای استقرار V1

این مخزن شامل اپ بیمار، اپ همراه پزشک، پنل وب/PWA بیمار و پزشک و API مشترک PostgreSQL است. پنل منشی در محدوده نسخه فعلی نیست.

## اجزای پروژه
- `mobile/`: اپ اندروید بیمار (Flutter)
- `doctor_mobile/`: اپ اندروید پزشک (Flutter)
- `web/`: رابط وب واکنش‌گرا و PWA بیمار/پزشک، قابل استقرار روی هاست استاتیک
- `backend/`: API با Node.js/Express و PostgreSQL
- `.github/workflows/`: ساخت APKهای ARM64 با GitHub Actions

## امکانات نسخه فعلی
- ثبت‌نام و ورود بیمار و تأیید حساب توسط پزشک
- فهرست بیمارانی که در PostgreSQL ثبت شده‌اند
- درخواست نوبت و تأیید/رد/ثبت انجام توسط پزشک
- ارسال گزارش علائم یا پیش‌ویزیت بیمار
- ثبت یادداشت بالینی؛ نمایش به بیمار فقط در صورت انتخاب پزشک
- ثبت برنامه پیگیری و داروهای ثبت‌شده توسط پزشک
- مشاهده مقالات آموزشی سایت رسمی mhsaffari.ir
- ثبت رویدادهای ممیزی پایه برای اقدامات مهم

## محدودیت مهم
وجود کد یا APK به معنای آنلاین بودن سرویس نیست. API باید روی سرویس سازگار با Node.js و PostgreSQL مستقر شود، SSL و CORS تنظیم شود و نسخه‌های موبایل برای نشانی واقعی API ساخته شوند. طرح ورود فعلی از کد ملی به‌عنوان اعتبار اولیه استفاده می‌کند و برای استفاده بالینی واقعی به احراز هویت مستقل و بازبینی امنیتی نیاز دارد. تا زمان تکمیل این مراحل از داده واقعی بیمار استفاده نکنید.

## استقرار API با Docker
نیاز است سرویس میزبانی، Docker و Docker Compose داشته باشد. اگر هاست cPanel شما این امکانات را ندارد، API را روی سرور سازگار جداگانه اجرا کنید.

1. پوشه `backend/` را به یک سرور امن منتقل کنید.
2. `backend/.env.example` را به `.env` کپی کنید. مقدارهای نمونه را تغییر دهید:
   - `POSTGRES_PASSWORD`: رمز تصادفی قوی برای PostgreSQL
   - `JWT_SECRET`: مقدار تصادفی طولانی و منحصربه‌فرد (حداقل ۳۲ کاراکتر)
   - `DOCTOR_PASSWORD_HASH`: هش bcrypt رمز عبور قوی پزشک
   - `CORS_ORIGINS`: origin دقیق پنل وب با HTTPS
3. از داخل پوشه `backend/` اجرا کنید:
   ```bash
   docker compose up -d --build
   ```
4. API به‌صورت داخلی روی `127.0.0.1:8080` در دسترس میزبان است. برای دسترسی عمومی فقط از reverse proxy با HTTPS استفاده کنید؛ پورت دیتابیس را عمومی نکنید.
5. مسیر `GET /health` را بررسی کنید. پاسخ سالم شامل `status: ok` است.
6. برای پایگاه داده‌ای که از قبل وجود دارد، فایل `schema.sql` را هم برای ایجاد جدول‌های جدید اجرا کنید؛ mount اولیه Docker فقط هنگام ساخته شدن volume خالی اجرا می‌شود.

### تولید رمزها
هش رمز پزشک را روی سرور خود تولید کنید (رمز واقعی را در GitHub، پیام‌رسان یا چت نفرستید):
```bash
cd backend
npm install
node -e "require('bcryptjs').hash('REPLACE_WITH_STRONG_PASSWORD',12).then(console.log)"
```
مقدار خروجی را در `DOCTOR_PASSWORD_HASH` قرار دهید و فایل `.env` را در Git اضافه نکنید.

## استقرار رابط وب/PWA
1. محتوای `web/` را در ریشه زیردامنه اختصاصی پنل، مانند `neurocare.mhsaffari.ir`، بارگذاری کنید.
2. در `web/config.js` مقدار `API_BASE_URL` را به آدرس واقعی API با HTTPS تغییر دهید (مسیر باید با `/v1` تمام شود).
3. مقدار `CORS_ORIGINS` در API باید دقیقاً origin رابط وب باشد؛ نمونه: `https://neurocare.mhsaffari.ir`.
4. گواهی SSL را فعال کنید؛ سپس وب‌اپ در مرورگر باز و به صفحه اصلی گوشی افزوده می‌شود.

## ساخت APK
آخرین کد Flutter در پوشه‌های `mobile/` و `doctor_mobile/` است. هر push به شاخه اصلی، workflow ساخت APK را اجرا می‌کند. فایل APK نهایی فقط پس از موفقیت workflow و بررسی artifacts قابل انتشار است. برای API سفارشی باید موقع ساخت از این مقدار برای هر دو اپ استفاده شود:
```bash
--dart-define=SAFFARI_API_BASE_URL=https://YOUR-API-HOST/v1
```

## APIهای اصلی
- `POST /v1/patients/register`, `POST /v1/patients/login`, `GET /v1/patients/me`
- `GET/POST /v1/patients/appointments`
- `GET /v1/doctor/appointments`, `PATCH /v1/doctor/appointments/:id/status`
- `GET/POST /v1/patients/reports`
- `GET /v1/doctor/patients`, `PATCH /v1/doctor/patients/:id/status`
- `GET/POST /v1/doctor/patients/:id/notes`; `GET /v1/patients/notes`
- `GET /v1/patients/treatment-plan`; `POST /v1/doctor/patients/:id/treatment-plan`
- `GET /v1/patients/medications`; `POST /v1/doctor/patients/:id/medications`

## امنیت و ایمنی بالینی
- از TLS/HTTPS، رمزهای یکتا، محدودیت تلاش ورود، بکاپ رمزگذاری‌شده و کمترین سطح دسترسی استفاده کنید.
- کد ملی داده حساس است؛ جریان ورود آزمایشی فعلی با کد ملی به‌عنوان رمز اولیه برای انتشار بالینی کافی نیست. احراز هویت مستقل، سیاست حفظ حریم خصوصی، بررسی امنیتی و تست نفوذ باید پیش از ورود بیمار واقعی انجام شود.
- پنل منشی وجود ندارد؛ دسترسی‌های فعلی بیمار و پزشک هستند.
- یادداشت‌ها و درمان‌ها باید توسط پزشک ثبت شوند؛ این سامانه تشخیص خودکار یا توصیه خودکار تغییر درمان ارائه نمی‌کند.
