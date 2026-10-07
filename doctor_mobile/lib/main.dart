import 'package:flutter/material.dart';

void main() => runApp(const DoctorApp());

class C {
  static const p = Color(0xFF0F6B78);
  static const bg = Color(0xFFF5F8F8);
  static const text = Color(0xFF173033);
  static const muted = Color(0xFF6B7C80);
  static const red = Color(0xFFD95C5C);
  static const yellow = Color(0xFFE9A23B);
  static const green = Color(0xFF4E9A6B);
}

class Patient {
  final String name, disease, status, value;
  final Color color;
  const Patient(this.name, this.disease, this.status, this.value, this.color);
}

const ps = [
  Patient('مریم احمدی', 'میگرن', 'نیازمند بررسی', '۷ روز سردرد / ماه', C.red),
  Patient('علی رضایی', 'MS', 'تغییر قابل توجه', 'پیگیری MRI', C.yellow),
  Patient('رضا کریمی', 'پارکینسون', 'پایدار', 'بدون تغییر جدید', C.green),
  Patient('سارا محمدی', 'صرع', 'پایدار', '۲ حمله در ماه', C.green),
];

class DoctorApp extends StatelessWidget {
  const DoctorApp({super.key});
  @override
  Widget build(BuildContext c) => MaterialApp(
    debugShowCheckedModeBanner: false,
    title: 'Saffari NeuroCare Doctor',
    theme: ThemeData(
      useMaterial3: true,
      colorScheme: ColorScheme.fromSeed(seedColor: C.p),
      scaffoldBackgroundColor: C.bg,
    ),
    builder: (context, child) => Directionality(
      textDirection: TextDirection.rtl,
      child: child!,
    ),
    home: const Home(),
  );
}

class Home extends StatelessWidget {
  const Home({super.key});

  @override
  Widget build(BuildContext c) => Scaffold(
    appBar: AppBar(
      title: const Text('داشبورد دکتر صفاری',
          style: TextStyle(fontWeight: FontWeight.w800)),
    ),
    body: ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: C.p,
            borderRadius: BorderRadius.circular(22),
          ),
          child: const Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('سلام دکتر صفاری',
                  style: TextStyle(color: Colors.white, fontSize: 24,
                      fontWeight: FontWeight.w900)),
              SizedBox(height: 6),
              Text('نمای سریع بیماران تحت پیگیری',
                  style: TextStyle(color: Color(0xDFFFFFFF))),
            ],
          ),
        ),
        const SizedBox(height: 12),
        Row(children: [
          _s('۱۲', 'بیمار امروز'),
          _s('۲', 'نیازمند بررسی'),
          _s('۳', 'مدرک جدید'),
        ]),
        const SizedBox(height: 16),
        const Text('بیماران نیازمند توجه',
            style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800,
                color: C.text)),
        const SizedBox(height: 8),
        ...ps.map((p) => Card(
          elevation: 0,
          margin: const EdgeInsets.only(bottom: 10),
          child: ListTile(
            contentPadding: const EdgeInsets.all(10),
            leading: Container(
              width: 10,
              height: 45,
              decoration: BoxDecoration(
                color: p.color,
                borderRadius: BorderRadius.circular(8),
              ),
            ),
            title: Text(p.name,
                style: const TextStyle(fontWeight: FontWeight.w800)),
            subtitle: Text('${p.disease} • ${p.value}\n${p.status}'),
            isThreeLine: true,
            trailing: const Icon(Icons.chevron_left),
            onTap: () => Navigator.push(
              c,
              MaterialPageRoute(builder: (_) => PatientPage(p)),
            ),
          ),
        )),
        const SizedBox(height: 8),
        const Card(
          elevation: 0,
          child: Padding(
            padding: EdgeInsets.all(16),
            child: Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                Chip(label: Text('میگرن و سردرد')),
                Chip(label: Text('MS')),
                Chip(label: Text('صرع')),
                Chip(label: Text('پارکینسون')),
                Chip(label: Text('اختلالات شناختی')),
              ],
            ),
          ),
        ),
      ],
    ),
  );

  static Widget _s(String a, String b) => Expanded(
    child: Card(
      elevation: 0,
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(children: [
          Text(a, style: const TextStyle(fontSize: 23,
              fontWeight: FontWeight.w900, color: C.p)),
          Text(b, textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 10, color: C.muted)),
        ]),
      ),
    ),
  );
}

class PatientPage extends StatelessWidget {
  final Patient p;
  const PatientPage(this.p, {super.key});

  @override
  Widget build(BuildContext c) => Scaffold(
    appBar: AppBar(title: Text(p.name)),
    body: ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Card(
          elevation: 0,
          child: Padding(
            padding: const EdgeInsets.all(18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(p.disease, style: const TextStyle(
                    color: C.p, fontWeight: FontWeight.w800)),
                const SizedBox(height: 8),
                Text(p.status, style: const TextStyle(
                    fontSize: 22, fontWeight: FontWeight.w900, color: C.text)),
                const SizedBox(height: 6),
                Text(p.value, style: const TextStyle(color: C.muted)),
              ],
            ),
          ),
        ),
        const SizedBox(height: 10),
        const Card(elevation: 0, child: ListTile(
          title: Text('خلاصه روند'),
          subtitle: Text('تغییرات اخیر بیمار برای بررسی پزشک علامت‌گذاری شده است.'),
        )),
        const Card(elevation: 0, child: ListTile(
          title: Text('درمان فعلی'),
          subtitle: Text('داروها و دستورهای درمانی فعلی در این بخش نمایش داده می‌شوند.'),
        )),
        const Card(elevation: 0, child: ListTile(
          title: Text('گزارش قبل از ویزیت'),
          subtitle: Text('آخرین گزارش بیمار آماده بررسی است.'),
        )),
        const Card(elevation: 0, child: ListTile(
          title: Text('مدارک'),
          subtitle: Text('MRI، آزمایش‌ها، EEG و سایر مدارک.'),
        )),
      ],
    ),
  );
}
