import 'package:flutter/material.dart';

void main() => runApp(const DoctorNeuroCareApp());

class DC {
  static const primary = Color(0xFF0E6B73);
  static const dark = Color(0xFF084A50);
  static const bg = Color(0xFFF4F8F8);
  static const text = Color(0xFF173033);
  static const muted = Color(0xFF708286);
  static const line = Color(0xFFE1EBEB);
  static const red = Color(0xFFD05C5C);
  static const orange = Color(0xFFD89A3C);
  static const green = Color(0xFF3E8F63);
  static const blue = Color(0xFF4C78B5);
}

enum DDisease { migraine, ms, epilepsy, parkinson, cognition }

extension DDiseaseX on DDisease {
  String get title {
    switch (this) {
      case DDisease.migraine: return 'میگرن';
      case DDisease.ms: return 'ام‌اس';
      case DDisease.epilepsy: return 'صرع';
      case DDisease.parkinson: return 'پارکینسون';
      case DDisease.cognition: return 'اختلالات شناختی';
    }
  }

  IconData get icon {
    switch (this) {
      case DDisease.migraine: return Icons.bolt_rounded;
      case DDisease.ms: return Icons.hub_rounded;
      case DDisease.epilepsy: return Icons.flash_on_rounded;
      case DDisease.parkinson: return Icons.accessibility_new_rounded;
      case DDisease.cognition: return Icons.psychology_alt_rounded;
    }
  }
}

enum PatientFlag { needsReview, change, stable }

class DPatient {
  final String name;
  final DDisease disease;
  final PatientFlag flag;
  final String primaryValue;
  final String lastVisit;
  final String preVisit;

  const DPatient(
    this.name,
    this.disease,
    this.flag,
    this.primaryValue,
    this.lastVisit,
    this.preVisit,
  );

  String get flagTitle {
    switch (flag) {
      case PatientFlag.needsReview: return 'نیازمند بررسی';
      case PatientFlag.change: return 'تغییر قابل توجه';
      case PatientFlag.stable: return 'پایدار';
    }
  }

  Color get flagColor {
    switch (flag) {
      case PatientFlag.needsReview: return DC.red;
      case PatientFlag.change: return DC.orange;
      case PatientFlag.stable: return DC.green;
    }
  }
}

const patients = [
  DPatient('مریم احمدی', DDisease.migraine, PatientFlag.needsReview, '۷ روز سردرد / ماه', '۱۴۰۵/۰۷/۰۷', 'تکمیل شده'),
  DPatient('علی رضایی', DDisease.ms, PatientFlag.change, 'MRI جدید', '۱۴۰۵/۰۷/۰۶', 'تغییر علامت گزارش شده'),
  DPatient('رضا کریمی', DDisease.parkinson, PatientFlag.stable, 'بدون تغییر عمده', '۱۴۰۵/۰۷/۰۵', 'تکمیل شده'),
  DPatient('سارا محمدی', DDisease.epilepsy, PatientFlag.stable, '۲ حمله / ماه', '۱۴۰۵/۰۷/۰۳', 'تکمیل شده'),
  DPatient('حسین کاظمی', DDisease.cognition, PatientFlag.needsReview, 'حافظه + ADL', '۱۴۰۵/۰۷/۰۲', 'ناقص'),
  DPatient('نرگس مرادی', DDisease.migraine, PatientFlag.change, 'افزایش مصرف داروی حمله', '۱۴۰۵/۰۷/۰۱', 'تکمیل شده'),
  DPatient('مهدی صادقی', DDisease.ms, PatientFlag.stable, 'علائم پایدار', '۱۴۰۵/۰۶/۲۸', 'تکمیل شده'),
];

class DoctorNeuroCareApp extends StatelessWidget {
  const DoctorNeuroCareApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'Saffari NeuroCare Doctor',
      theme: ThemeData(
        useMaterial3: true,
        scaffoldBackgroundColor: DC.bg,
        colorScheme: ColorScheme.fromSeed(seedColor: DC.primary),
        appBarTheme: const AppBarTheme(
          backgroundColor: DC.bg,
          foregroundColor: DC.text,
          elevation: 0,
        ),
        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: Colors.white,
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(16),
            borderSide: const BorderSide(color: DC.line),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(16),
            borderSide: const BorderSide(color: DC.line),
          ),
        ),
      ),
      builder: (_, child) => Directionality(
        textDirection: TextDirection.rtl,
        child: child ?? const SizedBox.shrink(),
      ),
      home: const DoctorLoginPage(),
    );
  }
}

class DoctorLoginPage extends StatefulWidget {
  const DoctorLoginPage({super.key});
  @override State<DoctorLoginPage> createState() => _DoctorLoginPageState();
}

class _DoctorLoginPageState extends State<DoctorLoginPage> {
  final code = TextEditingController(text: 'SAFFARI');
  final pass = TextEditingController(text: '1234');
  bool busy = false;

  @override
  void dispose() {
    code.dispose();
    pass.dispose();
    super.dispose();
  }

  Future<void> login() async {
    if (code.text.trim().isEmpty || pass.text.length < 4) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('کد پزشک و رمز عبور را وارد کنید.')),
      );
      return;
    }
    setState(() => busy = true);
    await Future.delayed(const Duration(milliseconds: 350));
    if (!mounted) return;
    Navigator.pushReplacement(
      context,
      MaterialPageRoute(builder: (_) => const DoctorShell()),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(22, 34, 22, 24),
          children: [
            Container(
              width: 82,
              height: 82,
              decoration: BoxDecoration(
                color: DC.primary,
                borderRadius: BorderRadius.circular(26),
              ),
              child: const Icon(
                Icons.medical_services_rounded,
                color: Colors.white,
                size: 42,
              ),
            ),
            const SizedBox(height: 18),
            const Text(
              'SAFFARI NEUROCARE',
              style: TextStyle(
                color: DC.dark,
                fontSize: 24,
                fontWeight: FontWeight.w900,
              ),
            ),
            const SizedBox(height: 5),
            const Text(
              'پنل پزشک • مراقبت هوشمند، همراه با دکتر صفاری',
              style: TextStyle(color: DC.muted),
            ),
            const SizedBox(height: 30),
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [DC.dark, DC.primary],
                ),
                borderRadius: BorderRadius.circular(24),
              ),
              child: const Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'مرکز فرماندهی پیگیری بیماران',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 20,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  SizedBox(height: 8),
                  Text(
                    'مرور سریع تغییرات، گزارش قبل از ویزیت، مدارک و برنامه درمان.',
                    style: TextStyle(color: Colors.white, height: 1.55),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 28),
            const Text(
              'ورود پزشک',
              style: TextStyle(
                fontSize: 23,
                fontWeight: FontWeight.w900,
                color: DC.text,
              ),
            ),
            const SizedBox(height: 14),
            TextField(
              controller: code,
              decoration: const InputDecoration(
                labelText: 'کد پزشک / کلینیک',
                prefixIcon: Icon(Icons.badge_outlined),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: pass,
              obscureText: true,
              decoration: const InputDecoration(
                labelText: 'رمز عبور',
                prefixIcon: Icon(Icons.lock_outline),
              ),
            ),
            const SizedBox(height: 16),
            SizedBox(
              height: 54,
              child: FilledButton.icon(
                onPressed: busy ? null : login,
                icon: busy
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.arrow_back_rounded),
                label: Text(busy ? 'در حال ورود...' : 'ورود به پنل'),
              ),
            ),
            const SizedBox(height: 12),
            const Text(
              'حساب آزمایشی: SAFFARI / 1234',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 11, color: DC.muted),
            ),
          ],
        ),
      ),
    );
  }
}

class DoctorShell extends StatefulWidget {
  const DoctorShell({super.key});
  @override State<DoctorShell> createState() => _DoctorShellState();
}

class _DoctorShellState extends State<DoctorShell> {
  int index = 0;
  final Set<String> reviewed = {};

  @override
  Widget build(BuildContext context) {
    final pages = [
      DoctorDashboard(onOpenPatients: () => setState(() => index = 1)),
      DoctorPatients(reviewed: reviewed),
      DoctorReports(),
      DoctorAccount(
        onLogout: () => Navigator.pushReplacement(
          context,
          MaterialPageRoute(builder: (_) => const DoctorLoginPage()),
        ),
      ),
    ];

    return Scaffold(
      body: SafeArea(child: pages[index]),
      bottomNavigationBar: NavigationBar(
        selectedIndex: index,
        onDestinationSelected: (v) => setState(() => index = v),
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.dashboard_outlined),
            selectedIcon: Icon(Icons.dashboard_rounded),
            label: 'داشبورد',
          ),
          NavigationDestination(
            icon: Icon(Icons.people_outline_rounded),
            selectedIcon: Icon(Icons.people_rounded),
            label: 'بیماران',
          ),
          NavigationDestination(
            icon: Icon(Icons.description_outlined),
            selectedIcon: Icon(Icons.description_rounded),
            label: 'گزارش‌ها',
          ),
          NavigationDestination(
            icon: Icon(Icons.settings_outlined),
            selectedIcon: Icon(Icons.settings_rounded),
            label: 'حساب',
          ),
        ],
      ),
    );
  }
}

class DoctorDashboard extends StatelessWidget {
  final VoidCallback onOpenPatients;
  const DoctorDashboard({super.key, required this.onOpenPatients});

  @override
  Widget build(BuildContext context) {
    final urgent = patients.where((p) => p.flag != PatientFlag.stable).length;
    return ListView(
      padding: const EdgeInsets.fromLTRB(18, 20, 18, 26),
      children: [
        const Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'سلام دکتر صفاری 👋',
                    style: TextStyle(
                      fontSize: 24,
                      fontWeight: FontWeight.w900,
                      color: DC.text,
                    ),
                  ),
                  SizedBox(height: 4),
                  Text(
                    'نمای سریع بیماران تحت پیگیری',
                    style: TextStyle(color: DC.muted),
                  ),
                ],
              ),
            ),
            CircleAvatar(
              radius: 25,
              backgroundColor: DC.primary,
              child: Icon(Icons.medical_services_rounded, color: Colors.white),
            ),
          ],
        ),
        const SizedBox(height: 16),
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            gradient: const LinearGradient(colors: [DC.dark, DC.primary]),
            borderRadius: BorderRadius.circular(24),
          ),
          child: Row(
            children: [
              const Icon(Icons.insights_rounded, color: Colors.white, size: 40),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: const [
                    Text(
                      'امروز: ۱۲ ویزیت',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 19,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    SizedBox(height: 5),
                    Text(
                      'گزارش‌های قبل از ویزیت را قبل از شروع مطب مرور کنید.',
                      style: TextStyle(color: Colors.white, height: 1.45),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),
        Row(
          children: [
            DoctorStat(value: '۱۲', label: 'ویزیت امروز', icon: Icons.calendar_today_rounded),
            DoctorStat(value: '$urgent', label: 'نیازمند توجه', icon: Icons.flag_rounded),
            const DoctorStat(value: '۵', label: 'مدرک جدید', icon: Icons.upload_file_rounded),
          ],
        ),
        const SizedBox(height: 18),
        Row(
          children: [
            const Expanded(
              child: Text(
                'بیماران مهم امروز',
                style: TextStyle(fontSize: 19, fontWeight: FontWeight.w900, color: DC.text),
              ),
            ),
            TextButton(onPressed: onOpenPatients, child: const Text('همه بیماران')),
          ],
        ),
        const SizedBox(height: 6),
        ...patients.where((p) => p.flag != PatientFlag.stable).take(4).map(
          (p) => Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: PatientTile(patient: p),
          ),
        ),
        const SizedBox(height: 10),
        const SectionHeaderDoctor('پنج محور پیگیری'),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: DDisease.values.map((d) {
            return Chip(
              avatar: Icon(d.icon, size: 17),
              label: Text(d.title),
            );
          }).toList(),
        ),
        const SizedBox(height: 18),
        Card(
          child: Column(
            children: [
              const ListTile(
                leading: Icon(Icons.auto_awesome_rounded, color: DC.primary),
                title: Text(
                  'خلاصه‌سازی هوشمند',
                  style: TextStyle(fontWeight: FontWeight.w900),
                ),
                subtitle: Text('پیش‌نویس برای کمک به مرور؛ تصمیم نهایی با پزشک است.'),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                child: OutlinedButton.icon(
                  onPressed: () => Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => PatientDetail(patient: patients[0]),
                    ),
                  ),
                  icon: const Icon(Icons.play_arrow_rounded),
                  label: const Text('باز کردن نمونه خلاصه'),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class DoctorPatients extends StatefulWidget {
  final Set<String> reviewed;
  const DoctorPatients({super.key, required this.reviewed});
  @override State<DoctorPatients> createState() => _DoctorPatientsState();
}

class _DoctorPatientsState extends State<DoctorPatients> {
  DDisease? filter;
  PatientFlag? flag;
  final search = TextEditingController();

  @override
  void dispose() {
    search.dispose();
    super.dispose();
  }

  List<DPatient> get filtered {
    final q = search.text.trim().toLowerCase();
    return patients.where((p) {
      final matchSearch = q.isEmpty ||
          p.name.toLowerCase().contains(q) ||
          p.disease.title.toLowerCase().contains(q);
      final matchDisease = filter == null || p.disease == filter;
      final matchFlag = flag == null || p.flag == flag;
      return matchSearch && matchDisease && matchFlag;
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    final list = filtered;
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(18, 20, 18, 10),
          child: Column(
            children: [
              const Align(
                alignment: Alignment.centerRight,
                child: Text(
                  'بیماران',
                  style: TextStyle(fontSize: 24, fontWeight: FontWeight.w900, color: DC.text),
                ),
              ),
              const SizedBox(height: 4),
              const Align(
                alignment: Alignment.centerRight,
                child: Text(
                  'جست‌وجو، فیلتر و ورود به پرونده',
                  style: TextStyle(color: DC.muted),
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: search,
                onChanged: (_) => setState(() {}),
                decoration: const InputDecoration(
                  hintText: 'نام بیمار یا بیماری…',
                  prefixIcon: Icon(Icons.search_rounded),
                ),
              ),
              const SizedBox(height: 10),
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  children: [
                    ChoiceChip(
                      label: const Text('همه'),
                      selected: filter == null,
                      onSelected: (_) => setState(() => filter = null),
                    ),
                    ...DDisease.values.map((d) => Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: ChoiceChip(
                        label: Text(d.title),
                        selected: filter == d,
                        onSelected: (_) => setState(() => filter = d),
                      ),
                    )),
                  ],
                ),
              ),
              const SizedBox(height: 8),
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  children: [
                    FilterButton(
                      text: 'همه وضعیت‌ها',
                      selected: flag == null,
                      onTap: () => setState(() => flag = null),
                    ),
                    FilterButton(
                      text: 'نیازمند بررسی',
                      selected: flag == PatientFlag.needsReview,
                      onTap: () => setState(() => flag = PatientFlag.needsReview),
                    ),
                    FilterButton(
                      text: 'تغییر قابل توجه',
                      selected: flag == PatientFlag.change,
                      onTap: () => setState(() => flag = PatientFlag.change),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        Expanded(
          child: list.isEmpty
              ? const Center(child: Text('بیماری با این فیلتر پیدا نشد.'))
              : ListView.separated(
                  padding: const EdgeInsets.fromLTRB(18, 4, 18, 24),
                  itemCount: list.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 8),
                  itemBuilder: (_, i) {
                    final p = list[i];
                    return PatientTile(
                      patient: p,
                      reviewed: widget.reviewed.contains(p.name),
                      onTap: () => Navigator.push(
                        context,
                        MaterialPageRoute(builder: (_) => PatientDetail(patient: p)),
                      ),
                    );
                  },
                ),
        ),
      ],
    );
  }
}

class DoctorReports extends StatelessWidget {
  const DoctorReports({super.key});

  @override
  Widget build(BuildContext context) {
    final reports = [
      ('مریم احمدی', 'میگرن', 'تکمیل شده', DC.green),
      ('علی رضایی', 'ام‌اس', 'تغییر علامت گزارش شده', DC.orange),
      ('حسین کاظمی', 'اختلالات شناختی', 'ناقص', DC.red),
      ('نرگس مرادی', 'میگرن', 'تکمیل شده', DC.green),
    ];

    return ListView(
      padding: const EdgeInsets.fromLTRB(18, 20, 18, 26),
      children: [
        const Text(
          'گزارش‌ها',
          style: TextStyle(fontSize: 24, fontWeight: FontWeight.w900, color: DC.text),
        ),
        const SizedBox(height: 4),
        const Text(
          'گزارش قبل از ویزیت و تغییرات مهم بیماران',
          style: TextStyle(color: DC.muted),
        ),
        const SizedBox(height: 16),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: const [
                Icon(Icons.assignment_rounded, color: DC.primary, size: 34),
                SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('۴ گزارش آماده', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900)),
                      SizedBox(height: 4),
                      Text('دو گزارش نیازمند توجه بیشتر هستند.', style: TextStyle(color: DC.muted)),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 12),
        ...reports.map((r) => Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: Card(
            child: ListTile(
              leading: CircleAvatar(
                backgroundColor: (r.$4).withOpacity(.12),
                child: Icon(Icons.assignment_rounded, color: r.$4),
              ),
              title: Text(r.$1, style: const TextStyle(fontWeight: FontWeight.w900)),
              subtitle: Text(r.$2 + ' • ' + r.$3),
              trailing: const Icon(Icons.chevron_left_rounded),
              onTap: () => Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (_) => PatientDetail(
                    patient: patients.firstWhere((p) => p.name == r.$1),
                  ),
                ),
              ),
            ),
          ),
        )),
      ],
    );
  }
}

class DoctorAccount extends StatelessWidget {
  final VoidCallback onLogout;
  const DoctorAccount({super.key, required this.onLogout});

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(18, 20, 18, 26),
      children: [
        const Text(
          'حساب پزشک',
          style: TextStyle(fontSize: 24, fontWeight: FontWeight.w900, color: DC.text),
        ),
        const SizedBox(height: 4),
        const Text('تنظیمات پنل و کنترل مسیر پیگیری', style: TextStyle(color: DC.muted)),
        const SizedBox(height: 16),
        const Card(
          child: ListTile(
            contentPadding: EdgeInsets.all(15),
            leading: CircleAvatar(
              radius: 29,
              backgroundColor: DC.primary,
              child: Icon(Icons.medical_services_rounded, color: Colors.white),
            ),
            title: Text('دکتر محمدحسین صفاری', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900)),
            subtitle: Text('نورولوژی • مسیر NeuroCare'),
          ),
        ),
        const SizedBox(height: 10),
        const DoctorSetting(
          icon: Icons.tune_rounded,
          title: 'تنظیمات خلاصه هوشمند',
          subtitle: 'فقط پیش‌نویس برای مرور پزشک',
        ),
        const SizedBox(height: 8),
        const DoctorSetting(
          icon: Icons.notifications_none_rounded,
          title: 'اعلان‌های پنل',
          subtitle: 'تغییر مهم، گزارش و مدرک جدید',
        ),
        const SizedBox(height: 8),
        const DoctorSetting(
          icon: Icons.security_rounded,
          title: 'امنیت و ثبت رویداد',
          subtitle: 'در نسخه عملیاتی با RBAC و Audit Log',
        ),
        const SizedBox(height: 8),
        const DoctorSetting(
          icon: Icons.cloud_done_rounded,
          title: 'وضعیت سرویس',
          subtitle: 'هسته نمایش آفلاین / آماده اتصال به API',
        ),
        const SizedBox(height: 22),
        FilledButton.tonalIcon(
          onPressed: onLogout,
          icon: const Icon(Icons.logout_rounded),
          label: const Text('خروج از حساب پزشک'),
        ),
      ],
    );
  }
}

class PatientDetail extends StatefulWidget {
  final DPatient patient;
  const PatientDetail({super.key, required this.patient});
  @override State<PatientDetail> createState() => _PatientDetailState();
}

class _PatientDetailState extends State<PatientDetail> {
  int tab = 0;
  bool markedReviewed = false;

  @override
  Widget build(BuildContext context) {
    final p = widget.patient;
    return Scaffold(
      appBar: AppBar(
        title: Text(p.name, style: const TextStyle(fontWeight: FontWeight.w900)),
        actions: [
          IconButton(
            onPressed: () => showDialog(
              context: context,
              builder: (_) => AlertDialog(
                title: const Text('اقدام سریع'),
                content: const Text('در نسخه عملیاتی می‌توان از همین صفحه طرح درمان، درخواست پیگیری و پیام پذیرش ایجاد کرد.'),
                actions: [
                  TextButton(
                    onPressed: () => Navigator.pop(context),
                    child: const Text('بستن'),
                  ),
                ],
              ),
            ),
            icon: const Icon(Icons.more_vert_rounded),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(18, 8, 18, 24),
        children: [
          PatientHero(patient: p),
          const SizedBox(height: 12),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                DetailChip('خلاصه', tab == 0, () => setState(() => tab = 0)),
                DetailChip('روند', tab == 1, () => setState(() => tab = 1)),
                DetailChip('درمان', tab == 2, () => setState(() => tab = 2)),
                DetailChip('مدارک', tab == 3, () => setState(() => tab = 3)),
                DetailChip('گزارش', tab == 4, () => setState(() => tab = 4)),
              ],
            ),
          ),
          const SizedBox(height: 14),
          if (tab == 0) const SizedBox()
          else if (tab == 1)
            TrendTab(patient: p)
          else if (tab == 2)
            TreatmentTab(patient: p)
          else if (tab == 3)
            DocumentsTab(patient: p)
          else
            ReportTab(patient: p),
          if (tab == 0) OverviewTab(patient: p),
          const SizedBox(height: 14),
          Card(
            child: ListTile(
              leading: const Icon(Icons.auto_awesome_rounded, color: DC.primary),
              title: const Text(
                'پیش‌نویس هوشمند برای پزشک',
                style: TextStyle(fontWeight: FontWeight.w900),
              ),
              subtitle: Text(aiSummary(p)),
            ),
          ),
          const SizedBox(height: 10),
          SizedBox(
            height: 50,
            child: FilledButton.icon(
              onPressed: () {
                setState(() => markedReviewed = true);
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('پرونده به‌عنوان بررسی‌شده علامت خورد.')),
                );
              },
              icon: Icon(markedReviewed ? Icons.verified_rounded : Icons.check_rounded),
              label: Text(markedReviewed ? 'بررسی شد' : 'علامت‌گذاری به‌عنوان بررسی‌شده'),
            ),
          ),
        ],
      ),
    );
  }
}

class PatientHero extends StatelessWidget {
  final DPatient patient;
  const PatientHero({super.key, required this.patient});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Container(
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(20),
          gradient: const LinearGradient(colors: [DC.dark, DC.primary]),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                CircleAvatar(
                  radius: 27,
                  backgroundColor: Colors.white.withOpacity(.14),
                  child: Icon(patient.disease.icon, color: Colors.white, size: 28),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        patient.disease.title,
                        style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700),
                      ),
                      const SizedBox(height: 5),
                      Text(
                        patient.flagTitle,
                        style: TextStyle(
                          color: patient.flagColor == DC.green ? Colors.white : const Color(0xFFFFE4C5),
                          fontWeight: FontWeight.w900,
                          fontSize: 18,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),
            Text(
              patient.primaryValue,
              style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w900),
            ),
            const SizedBox(height: 4),
            Text(
              'آخرین ویزیت: ' + patient.lastVisit,
              style: const TextStyle(color: Colors.white70),
            ),
          ],
        ),
      ),
    );
  }
}

class OverviewTab extends StatelessWidget {
  final DPatient patient;
  const OverviewTab({super.key, required this.patient});

  @override
  Widget build(BuildContext context) {
    final metrics = detailMetrics(patient.disease);
    return Column(
      children: [
        GridView.count(
          crossAxisCount: 2,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          mainAxisSpacing: 8,
          crossAxisSpacing: 8,
          childAspectRatio: 1.45,
          children: metrics.map((m) => DetailMetric(m.$1, m.$2, m.$3)).toList(),
        ),
        const SizedBox(height: 10),
        const SectionHeaderDoctor('آخرین وضعیت ثبت‌شده'),
        const SizedBox(height: 8),
        Card(
          child: Column(
            children: [
              ListTile(
                leading: const Icon(Icons.assignment_rounded, color: DC.primary),
                title: const Text('گزارش پیش از ویزیت'),
                subtitle: Text(patient.preVisit),
              ),
              const Divider(height: 1),
              const ListTile(
                leading: Icon(Icons.medication_rounded, color: DC.primary),
                title: Text('درمان فعلی'),
                subtitle: Text('درمان و دوزها از نسخه رسمی کلینیک خوانده می‌شوند.'),
              ),
              const Divider(height: 1),
              const ListTile(
                leading: Icon(Icons.event_note_rounded, color: DC.primary),
                title: Text('ویزیت بعدی'),
                subtitle: Text('سه‌شنبه • ۱۷:۳۰ • پیگیری'),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class TrendTab extends StatelessWidget {
  final DPatient patient;
  const TrendTab({super.key, required this.patient});

  @override
  Widget build(BuildContext context) {
    final values = trendValues(patient.disease);
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('روند ۷ نقطه اخیر', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900)),
            const SizedBox(height: 6),
            Text(
              trendDescription(patient.disease),
              style: const TextStyle(color: DC.muted, height: 1.6),
            ),
            const SizedBox(height: 14),
            SizedBox(height: 190, child: DoctorChart(values: values)),
          ],
        ),
      ),
    );
  }
}

class TreatmentTab extends StatelessWidget {
  final DPatient patient;
  const TreatmentTab({super.key, required this.patient});

  @override
  Widget build(BuildContext context) {
    final items = treatmentFor(patient.disease);
    return Column(
      children: [
        Card(
          child: ListTile(
            leading: const Icon(Icons.flag_rounded, color: DC.primary),
            title: const Text('هدف درمان', style: TextStyle(fontWeight: FontWeight.w900)),
            subtitle: Text(treatmentGoal(patient.disease)),
          ),
        ),
        const SizedBox(height: 8),
        ...items.map((x) => Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: Card(
            child: ListTile(
              leading: const Icon(Icons.medication_rounded, color: DC.primary),
              title: Text(x.$1, style: const TextStyle(fontWeight: FontWeight.w900)),
              subtitle: Text(x.$2),
              trailing: const Icon(Icons.chevron_left_rounded),
            ),
          ),
        )),
        const SizedBox(height: 6),
        FilledButton.tonalIcon(
          onPressed: () => ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('ایجاد طرح درمان از این صفحه آماده اتصال به API است.')),
          ),
          icon: const Icon(Icons.add_task_rounded),
          label: const Text('ایجاد / به‌روزرسانی طرح درمان'),
        ),
      ],
    );
  }
}

class DocumentsTab extends StatelessWidget {
  final DPatient patient;
  const DocumentsTab({super.key, required this.patient});

  @override
  Widget build(BuildContext context) {
    final docs = patient.disease == DDisease.ms
        ? ['MRI مغز ۱۴۰۵/۰۶/۲۱', 'آزمایش خون ۱۴۰۵/۰۶/۱۸', 'ویزیت قبلی']
        : patient.disease == DDisease.epilepsy
            ? ['EEG ۱۴۰۵/۰۵/۳۰', 'نسخه قبلی', 'گزارش اورژانس']
            : ['نسخه ثبت‌شده', 'آزمایش خون', 'گزارش ویزیت قبلی'];
    return Column(
      children: docs.map((d) => Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: Card(
          child: ListTile(
            leading: const Icon(Icons.description_rounded, color: DC.primary),
            title: Text(d, style: const TextStyle(fontWeight: FontWeight.w900)),
            subtitle: const Text('مدرک پرونده • دسترسی پزشک'),
            trailing: const Icon(Icons.open_in_new_rounded),
            onTap: () => ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text('نمایش «' + d + '» آماده اتصال به فایل واقعی است.')),
            ),
          ),
        ),
      )).toList(),
    );
  }
}

class ReportTab extends StatelessWidget {
  final DPatient patient;
  const ReportTab({super.key, required this.patient});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Card(
          child: Padding(
            padding: const EdgeInsets.all(18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('گزارش قبل از ویزیت', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900)),
                const SizedBox(height: 10),
                Text(
                  'بیمار: ' + patient.name + '\n'
                  'بیماری: ' + patient.disease.title + '\n'
                  'وضعیت: ' + patient.flagTitle + '\n'
                  'تکمیل گزارش: ' + patient.preVisit + '\n\n'
                  'خلاصه: بیمار تغییرات اخیر را ثبت کرده است و موارد مهم باید در ویزیت مرور شوند.',
                  style: const TextStyle(height: 1.7),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 8),
        OutlinedButton.icon(
          onPressed: () => ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('گزارش برای این بیمار به‌عنوان مرورشده ذخیره شد.')),
          ),
          icon: const Icon(Icons.done_all_rounded),
          label: const Text('ثبت مرور گزارش'),
        ),
      ],
    );
  }
}

class PatientTile extends StatelessWidget {
  final DPatient patient;
  final VoidCallback? onTap;
  final bool reviewed;

  const PatientTile({
    super.key,
    required this.patient,
    this.onTap,
    this.reviewed = false,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 13, vertical: 5),
        leading: Container(
          width: 9,
          height: 52,
          decoration: BoxDecoration(
            color: patient.flagColor,
            borderRadius: BorderRadius.circular(9),
          ),
        ),
        title: Row(
          children: [
            Expanded(
              child: Text(
                patient.name,
                style: const TextStyle(fontWeight: FontWeight.w900),
              ),
            ),
            if (reviewed)
              const Icon(Icons.verified_rounded, size: 19, color: DC.green),
          ],
        ),
        subtitle: Text(
          patient.disease.title + ' • ' + patient.primaryValue + '\n' + patient.flagTitle,
        ),
        isThreeLine: true,
        trailing: const Icon(Icons.chevron_left_rounded),
        onTap: onTap,
      ),
    );
  }
}

class DoctorStat extends StatelessWidget {
  final String value;
  final String label;
  final IconData icon;
  const DoctorStat({super.key, required this.value, required this.label, required this.icon});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Card(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 6),
          child: Column(
            children: [
              Icon(icon, size: 20, color: DC.primary),
              const SizedBox(height: 6),
              Text(value, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: DC.primary)),
              Text(label, textAlign: TextAlign.center, style: const TextStyle(fontSize: 10, color: DC.muted)),
            ],
          ),
        ),
      ),
    );
  }
}

class FilterButton extends StatelessWidget {
  final String text;
  final bool selected;
  final VoidCallback onTap;
  const FilterButton({super.key, required this.text, required this.selected, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(left: 8),
      child: FilterChip(
        label: Text(text),
        selected: selected,
        onSelected: (_) => onTap(),
      ),
    );
  }
}

class DetailChip extends StatelessWidget {
  final String text;
  final bool selected;
  final VoidCallback onTap;
  const DetailChip(this.text, this.selected, this.onTap, {super.key});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(left: 8),
      child: ChoiceChip(
        label: Text(text),
        selected: selected,
        onSelected: (_) => onTap(),
      ),
    );
  }
}

class DetailMetric extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;
  const DetailMetric(this.label, this.value, this.icon, {super.key});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(13),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            CircleAvatar(
              radius: 17,
              backgroundColor: const Color(0xFFE8F2F2),
              child: Icon(icon, size: 17, color: DC.primary),
            ),
            const Spacer(),
            Text(label, style: const TextStyle(color: DC.muted, fontSize: 11)),
            const SizedBox(height: 4),
            Text(value, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w900)),
          ],
        ),
      ),
    );
  }
}

class SectionHeaderDoctor extends StatelessWidget {
  final String text;
  const SectionHeaderDoctor(this.text, {super.key});

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.centerRight,
      child: Text(
        text,
        style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: DC.text),
      ),
    );
  }
}

class DoctorSetting extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  const DoctorSetting({super.key, required this.icon, required this.title, required this.subtitle});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: const Color(0xFFE8F2F2),
          child: Icon(icon, color: DC.primary),
        ),
        title: Text(title, style: const TextStyle(fontWeight: FontWeight.w900)),
        subtitle: Text(subtitle),
        trailing: const Icon(Icons.chevron_left_rounded),
      ),
    );
  }
}

class DoctorChart extends StatelessWidget {
  final List<double> values;
  const DoctorChart({super.key, required this.values});

  @override
  Widget build(BuildContext context) {
    return CustomPaint(
      painter: DoctorChartPainter(values),
      child: const SizedBox.expand(),
    );
  }
}

class DoctorChartPainter extends CustomPainter {
  final List<double> values;
  DoctorChartPainter(this.values);

  @override
  void paint(Canvas canvas, Size size) {
    if (values.length < 2) return;
    final line = Paint()
      ..color = DC.primary
      ..strokeWidth = 3
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;
    final grid = Paint()
      ..color = DC.line
      ..strokeWidth = 1;
    for (var i = 1; i < 4; i++) {
      final y = size.height * i / 4;
      canvas.drawLine(Offset(0, y), Offset(size.width, y), grid);
    }
    final max = values.reduce((a, b) => a > b ? a : b);
    final min = values.reduce((a, b) => a < b ? a : b);
    final range = (max - min).abs() < .1 ? 1 : max - min;
    final dx = size.width / (values.length - 1);
    final path = Path();
    for (var i = 0; i < values.length; i++) {
      final y = size.height - ((values[i] - min) / range) * (size.height - 20) - 10;
      if (i == 0) {
        path.moveTo(i * dx, y);
      } else {
        path.lineTo(i * dx, y);
      }
    }
    canvas.drawPath(path, line);
    for (var i = 0; i < values.length; i++) {
      final y = size.height - ((values[i] - min) / range) * (size.height - 20) - 10;
      canvas.drawCircle(Offset(i * dx, y), 4, Paint()..color = DC.primary);
    }
  }

  @override
  bool shouldRepaint(covariant DoctorChartPainter oldDelegate) => true;
}

String aiSummary(DPatient p) {
  switch (p.disease) {
    case DDisease.migraine:
      return 'پیش‌نویس: تعداد روزهای سردرد ۷ در ماه است؛ مصرف داروی حمله و روند شدت در ویزیت مرور شود.';
    case DDisease.ms:
      return 'پیش‌نویس: MRI جدید و تغییر علامت گزارش شده است؛ مقایسه با MRI قبلی و مرور درمان پیشنهاد می‌شود.';
    case DDisease.epilepsy:
      return 'پیش‌نویس: دو حمله اخیر ثبت شده‌اند؛ زمان، مدت، هوشیاری و محرک احتمالی مرور شوند.';
    case DDisease.parkinson:
      return 'پیش‌نویس: وضعیت حرکتی پایدار گزارش شده؛ خواب و تعادل برای پیگیری بعدی مهم هستند.';
    case DDisease.cognition:
      return 'پیش‌نویس: حافظه و ADL نیازمند ثبت منظم هستند؛ همراه بیمار می‌تواند در تکمیل گزارش کمک کند.';
  }
}

List<(String, String, IconData)> detailMetrics(DDisease d) {
  switch (d) {
    case DDisease.migraine:
      return [
        ('روزهای سردرد', '۷ / ماه', Icons.calendar_today_rounded),
        ('حملات شدید', '۲', Icons.warning_amber_rounded),
        ('داروی حمله', '۳ روز', Icons.medication_rounded),
        ('روند', 'کمی بهتر', Icons.trending_down_rounded),
      ];
    case DDisease.ms:
      return [
        ('خستگی', 'متوسط', Icons.battery_3_bar_rounded),
        ('حرکت', 'پایدار', Icons.directions_walk_rounded),
        ('MRI', 'جدید', Icons.image_rounded),
        ('پایبندی', 'منظم', Icons.verified_rounded),
      ];
    case DDisease.epilepsy:
      return [
        ('حملات', '۲ / ماه', Icons.flash_on_rounded),
        ('مدت', '<۲ دقیقه', Icons.timer_outlined),
        ('هوشیاری', 'متغیر', Icons.visibility_rounded),
        ('محرک', 'ثبت شده', Icons.fact_check_rounded),
      ];
    case DDisease.parkinson:
      return [
        ('لرزش', 'متوسط', Icons.vibration_rounded),
        ('سفتی', 'خفیف', Icons.accessibility_new_rounded),
        ('تعادل', 'قابل قبول', Icons.balance_rounded),
        ('خواب', 'ثبت ناقص', Icons.bedtime_rounded),
      ];
    case DDisease.cognition:
      return [
        ('حافظه', 'نیازمند پیگیری', Icons.psychology_alt_rounded),
        ('خلق', 'پایدار', Icons.sentiment_satisfied_alt_rounded),
        ('خواب', 'متوسط', Icons.bedtime_rounded),
        ('ADL', 'با کمک', Icons.home_rounded),
      ];
  }
}

List<double> trendValues(DDisease d) {
  switch (d) {
    case DDisease.migraine: return [9, 8, 8, 7, 7, 6, 7];
    case DDisease.ms: return [6, 6, 5, 6, 5, 5, 5];
    case DDisease.epilepsy: return [4, 3, 4, 2, 3, 2, 2];
    case DDisease.parkinson: return [5, 5, 4, 5, 4, 4, 4];
    case DDisease.cognition: return [3, 4, 4, 5, 5, 5, 6];
  }
}

String trendDescription(DDisease d) {
  switch (d) {
    case DDisease.migraine: return 'روند ثبت‌شده نشان می‌دهد تعداد روزهای سردرد کاهش داشته، اما مصرف داروی حمله باید در ویزیت بازبینی شود.';
    case DDisease.ms: return 'علائم روزمره پایدار است و MRI جدید باید با تصویربرداری قبلی مقایسه شود.';
    case DDisease.epilepsy: return 'تعداد رخدادهای اخیر کم اما قابل توجه است؛ جزئیات هر حمله در پرونده ثبت می‌شود.';
    case DDisease.parkinson: return 'روند علائم حرکتی تقریباً ثابت است؛ ثبت خواب و تعادل می‌تواند حساسیت پیگیری را بیشتر کند.';
    case DDisease.cognition: return 'روند ثبت‌شده نیازمند داده‌های بیشتر برای مقایسه معنادار است.';
  }
}

String treatmentGoal(DDisease d) {
  switch (d) {
    case DDisease.migraine: return 'کاهش دفعات و شدت حملات و بهبود عملکرد روزانه.';
    case DDisease.ms: return 'پایش علائم، MRI و پایبندی به درمان تعدیل‌کننده بیماری.';
    case DDisease.epilepsy: return 'کاهش خطر حملات و ثبت دقیق الگو و محرک‌های احتمالی.';
    case DDisease.parkinson: return 'حفظ تحرک، تعادل و کیفیت زندگی.';
    case DDisease.cognition: return 'پایش حافظه، خواب، خلق و فعالیت‌های روزمره.';
  }
}

List<(String, String)> treatmentFor(DDisease d) {
  switch (d) {
    case DDisease.migraine:
      return [
        ('داروی پیشگیری', 'طبق نسخه • روزانه'),
        ('داروی حمله', 'در شروع حمله • طبق دستور'),
      ];
    case DDisease.ms:
      return [
        ('درمان تعدیل‌کننده', 'طبق برنامه نسخه'),
        ('داروی علامتی', 'طبق دستور پزشک'),
      ];
    case DDisease.epilepsy:
      return [
        ('داروی ضدتشنج', 'طبق زمان‌بندی'),
        ('داروی نجات', 'طبق شرایط تعیین‌شده'),
      ];
    case DDisease.parkinson:
      return [
        ('داروی حرکتی', 'طبق ساعت‌های نسخه'),
        ('داروی کمکی', 'طبق نسخه'),
      ];
    case DDisease.cognition:
      return [
        ('داروی شناختی', 'طبق نسخه و زمان‌بندی'),
        ('داروی همراه', 'طبق دستور پزشک'),
      ];
  }
}
