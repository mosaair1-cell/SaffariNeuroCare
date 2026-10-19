# Saffari NeuroCare

سامانه مراقبت بیماران دکتر صفاری با اپ اندروید بیمار، اپ پزشک و دو وب‌اپ مستقل. **بک‌اند هدف نسخه فعلی Supabase Edge Functions + PostgreSQL است.** پوشه `backend/` نسخه قدیمی Node/Express است و در استقرار Supabase استفاده نمی‌شود.

## وب‌اپ‌ها
- بیمار: `https://app.mhsaffari.ir/`؛ فقط محتویات `web/patient/` را در Document Root جداگانه آن قرار دهید.
- پزشک: `https://doctor-app.mhsaffari.ir/`؛ فقط محتویات `web/doctor/` را در Document Root جداگانه آن قرار دهید.
- دو دامنه باید DNS و HTTPS مستقل داشته باشند؛ پنل پزشک از رابط بیمار جداست.

## ساختار کد
- `supabase/schema.sql`: schema با RLS فعال و دسترسی مستقیم محدود به Edge Function
- `supabase/functions/neurocare-api/index.ts`: API مشترک ثبت‌نام، ورود، نوبت‌ها، گزارش علائم، یادداشت‌های بالینی، برنامه پیگیری و داروها
- `supabase/config.toml`: تنظیم احراز هویت سفارشی Edge Function
- `web/patient/` و `web/doctor/`: وب‌اپ‌ها با نقش قفل‌شده در پیکربندی
- `mobile/` و `doctor_mobile/`: دو اپ Flutter

## استقرار
راهنمای فارسی: [supabase/README.md](supabase/README.md). قبل از انتشار، ساخت پروژه Supabase، اعمال schema، deploy تابع، ایجاد حساب پزشک، وارد کردن Publishable Key و API URL در پیکربندی و تنظیم DNS/SSL باید تکمیل شوند. مخزن عمومی نیست جای نگهداری رمز واقعی یا کلید Secret؛ هیچ‌کدام را Commit نکنید.

## محدودیت امنیتی مهم
جریان اولیه بیمار از کد ملی به‌عنوان رمز موقت استفاده می‌کند و وب‌اپ بیمار اجبار به تغییر رمز مستقل حداقل ۱۲ نویسه‌ای دارد. با این حال، قبل از ورود هرگونه داده پزشکی واقعی لازم است احراز هویت و بازیابی امن حساب، بازبینی امنیتی، پشتیبان‌گیری مستقل و اعتبارسنجی بالینی تکمیل شوند. نسخه فعلی فاقد پنل منشی است.
