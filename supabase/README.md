# استقرار Supabase

## 1. قبل از شروع
این مخزن از Supabase PostgreSQL و Edge Function به نام `neurocare-api` استفاده می‌کند. پوشه `backend/` نسخه قدیمی Express است و برای این استقرار استفاده نشود.

## 2. دیتابیس
فایل `schema.sql` را از این پوشه در SQL Editor پروژه Supabase اجرا کنید. جداول با RLS فعال و مجوزهای مستقیم `anon` و `authenticated` لغو شده‌اند؛ تنها Edge Function با کلید Secret سرور عملیات دیتابیس را اجرا می‌کند.

در پروژه‌های Supabase جدید ممکن است لازم باشد `public` را در بخش Settings > API > Exposed schemas برای Data API فعال کنید تا Edge Function بتواند از PostgREST استفاده کند. جداول همچنان برای نقش‌های عمومی مجوز ندارند؛ Publishable Key به تنهایی نباید اجازه خواندن پرونده بدهد.

## 3. Edge Function
`config.toml` در این پوشه `verify_jwt = false` را برای `neurocare-api` مشخص می‌کند، چون این API از توکن تصادفی opaque استفاده کرده و خود تابع آن را با hash نشست اعتبارسنجی می‌کند. پس از ایجاد پروژه:
```bash
supabase login
supabase link --project-ref YOUR-PROJECT-REF
supabase functions deploy neurocare-api --no-verify-jwt
```
تابع به متغیرهای پیش‌فرض Supabase متکی است. از کلید `SUPABASE_SECRET_KEYS` (کلید پیش‌فرض) استفاده می‌کند و در صورت نبود، برای سازگاری از `SUPABASE_SERVICE_ROLE_KEY` استفاده می‌کند. این کلیدها نباید به مرورگر یا اپ موبایل برسند.

## 4. ایجاد حساب پزشک
پس از اجرای schema، رمز قدرتمند و منحصربه‌فردی انتخاب کنید و فقط هش bcrypt را داخل `doctor_accounts` درج کنید. کد ورود پزشک `SAFFARI` است. رمز واقعی را در GitHub، کد برنامه یا مکالمه عمومی قرار ندهید. باید مسیر ایجاد/تغییر رمز پزشک و بازیابی امن آن قبل از پذیرش بیماران واقعی نهایی شود.

## 5. تنظیم کلاینت‌ها
- API Function base URL: `https://YOUR-PROJECT-REF.supabase.co/functions/v1/neurocare-api/v1`
- Publishable Key از Settings > API Keys در سه فایل پیکربندی وب قرار می‌گیرد. این کلید عمومی است؛ Secret Key خصوصی است.
- برای ساخت APK، متغیرهای Repository Variables در GitHub را تنظیم کنید: `SAFFARI_API_BASE_URL` و `SUPABASE_PUBLISHABLE_KEY`.
- Health check: `GET https://YOUR-PROJECT-REF.supabase.co/functions/v1/neurocare-api/health`؛ درخواست مستقیم به Edge Function باید header `apikey` حاوی Publishable Key داشته باشد.

## 6. محدودیت‌های Free
سقف‌های داشبورد ارائه‌شده: Egress 5 GB، دیتابیس 500 MB/project، 50,000 MAU، Storage 1 GB، Log Ingestion 1 GB، Log Query 100 GB. مستندات رسمی همچنین سهمیه 500,000 Edge Function invocation در ماه را ذکر می‌کنند. برای بهینه‌سازی:
- فایل MRI، PDF و تصاویر را داخل Postgres ذخیره نکنید. Storage در نسخه فعلی برای پیوست فعال نشده است.
- پاسخ‌های API کوچک نگه داشته شده‌اند؛ لاگ‌های تولیدی نباید شامل کد ملی یا متن یادداشت پزشکی شوند.
- Free ممکن است پروژه کم‌فعالیت را پس از 7 روز Pause کند و امکانات بکاپ قابل دانلود خودکار محدودتر از پلن‌های پولی است. پیش از هر استفاده بالینی، بکاپ مستقل روزانه و آزمون بازیابی لازم است.

## 7. دامنه‌ها
وب‌اپ بیمار: `app.mhsaffari.ir` از پوشه `web/patient/`.
پنل پزشک: `doctor-app.mhsaffari.ir` از پوشه `web/doctor/`.
هر کدام باید Document Root مستقل و HTTPS داشته باشند. پنل پزشک را در پوشه یا مسیر قابل دسترسی از وب‌اپ بیمار قرار ندهید.
