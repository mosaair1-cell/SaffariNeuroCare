import 'package:flutter/material.dart';

void main() => runApp(const SaffariNeuroCareApp());

class AppColors {
  static const primary = Color(0xFF0E6B73);
  static const dark = Color(0xFF084A50);
  static const bg = Color(0xFFF4F8F8);
  static const text = Color(0xFF173033);
  static const muted = Color(0xFF708286);
  static const line = Color(0xFFE1EBEB);
  static const success = Color(0xFF3E8F63);
  static const warning = Color(0xFFD89A3C);
  static const danger = Color(0xFFD05C5C);
}

enum Disease { migraine, ms, epilepsy, parkinson, cognition }

extension DiseaseX on Disease {
  String get title {
    switch (this) {
      case Disease.migraine: return 'میگرن و اختلالات سردرد';
      case Disease.ms: return 'ام‌اس';
      case Disease.epilepsy: return 'صرع و حملات تشنجی';
      case Disease.parkinson: return 'پارکینسون';
      case Disease.cognition: return 'اختلالات شناختی';
    }
  }

  String get shortName {
    switch (this) {
      case Disease.migraine: return 'میگرن';
      case Disease.ms: return 'ام‌اس';
      case Disease.epilepsy: return 'صرع';
      case Disease.parkinson: return 'پارکینسون';
      case Disease.cognition: return 'شناختی';
    }
  }

  IconData get icon {
    switch (this) {
      case Disease.migraine: return Icons.bolt_rounded;
      case Disease.ms: return Icons.hub_rounded;
      case Disease.epilepsy: return Icons.flash_on_rounded;
      case Disease.parkinson: return Icons.accessibility_new_rounded;
      case Disease.cognition: return Icons.psychology_alt_rounded;
    }
  }

  Color get tint {
    switch (this) {
      case Disease.migraine: return const Color(0xFFEAF1FF);
      case Disease.ms: return const Color(0xFFE9F7F1);
      case Disease.epilepsy: return const Color(0xFFFFF3DD);
      case Disease.parkinson: return const Color(0xFFF0EAFD);
      case Disease.cognition: return const Color(0xFFFBE9E9);
    }
  }
}

class SaffariNeuroCareApp extends StatelessWidget {
  const SaffariNeuroCareApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'Saffari NeuroCare',
      theme: ThemeData(
        useMaterial3: true,
        scaffoldBackgroundColor: AppColors.bg,
        colorScheme: ColorScheme.fromSeed(seedColor: AppColors.primary),
        appBarTheme: const AppBarTheme(
          backgroundColor: AppColors.bg,
          foregroundColor: AppColors.text,
          elevation: 0,
        ),
        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: Colors.white,
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(16),
            borderSide: const BorderSide(color: AppColors.line),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(16),
            borderSide: const BorderSide(color: AppColors.line),
          ),
        ),
      ),
      builder: (context, child) => Directionality(
        textDirection: TextDirection.rtl,
        child: child ?? const SizedBox.shrink(),
      ),
      home: const LoginPage(),
    );
  }
}

class PatientIdentity {
  String firstName;
  String lastName;
  String mobile;
  final String nationalId;

  PatientIdentity({
    required this.firstName,
    required this.lastName,
    required this.mobile,
    required this.nationalId,
  });

  String get fullName => (firstName.trim() + ' ' + lastName.trim()).trim();
}

PatientIdentity currentPatient = PatientIdentity(
  firstName: 'محمدحسین',
  lastName: 'رضایی',
  mobile: '09123456789',
  nationalId: '0012345678',
);

class LoginPage extends StatefulWidget {
  const LoginPage({super.key});
  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final mobile = TextEditingController(text: '09123456789');
  final nationalId = TextEditingController(text: '0012345678');
  bool busy = false;

  @override
  void dispose() {
    mobile.dispose();
    nationalId.dispose();
    super.dispose();
  }

  Future<void> login() async {
    final m = mobile.text.trim();
    final n = nationalId.text.trim();
    if (m.length < 10 || n.length != 10) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('شماره موبایل و کد ملی را کامل و صحیح وارد کنید.'),
        ),
      );
      return;
    }

    setState(() => busy = true);
    await Future.delayed(const Duration(milliseconds: 300));
    if (!mounted) return;

    currentPatient.mobile = m;
    currentPatient = PatientIdentity(
      firstName: currentPatient.firstName,
      lastName: currentPatient.lastName,
      mobile: m,
      nationalId: n,
    );

    Navigator.pushReplacement(
      context,
      MaterialPageRoute(builder: (_) => const ClinicLinkPage()),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(22, 30, 22, 24),
          children: [
            Container(
              width: 82,
              height: 82,
              decoration: BoxDecoration(
                color: AppColors.primary,
                borderRadius: BorderRadius.circular(26),
              ),
              child: const Icon(
                Icons.psychology_alt_rounded,
                size: 45,
                color: Colors.white,
              ),
            ),
            const SizedBox(height: 18),
            const Text(
              'SAFFARI NEUROCARE',
              style: TextStyle(
                color: AppColors.dark,
                fontSize: 25,
                fontWeight: FontWeight.w900,
              ),
            ),
            const SizedBox(height: 6),
            const Text(
              'مراقبت هوشمند، همراه با دکتر صفاری',
              style: TextStyle(color: AppColors.muted),
            ),
            const SizedBox(height: 28),
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [AppColors.dark, AppColors.primary],
                ),
                borderRadius: BorderRadius.circular(24),
              ),
              child: const Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'ورود بدون OTP',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 21,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  SizedBox(height: 8),
                  Text(
                    'شماره موبایل نام کاربری شماست و کد ملی، رمز ورود اولیه است.',
                    style: TextStyle(color: Colors.white, height: 1.55),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 26),
            const Text(
              'ورود بیمار',
              style: TextStyle(
                color: AppColors.text,
                fontSize: 23,
                fontWeight: FontWeight.w900,
              ),
            ),
            const SizedBox(height: 14),
            TextField(
              controller: mobile,
              keyboardType: TextInputType.phone,
              decoration: const InputDecoration(
                labelText: 'شماره موبایل',
                prefixIcon: Icon(Icons.phone_outlined),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: nationalId,
              keyboardType: TextInputType.number,
              maxLength: 10,
              obscureText: true,
              decoration: const InputDecoration(
                labelText: 'کد ملی (رمز عبور)',
                prefixIcon: Icon(Icons.fingerprint_rounded),
                counterText: '',
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
                    : const Icon(Icons.login_rounded),
                label: Text(busy ? 'در حال ورود...' : 'ورود'),
              ),
            ),
            const SizedBox(height: 10),
            OutlinedButton.icon(
              onPressed: () => Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const RegisterPage()),
              ),
              icon: const Icon(Icons.person_add_alt_1_rounded),
              label: const Text('ایجاد حساب جدید'),
            ),
            const SizedBox(height: 12),
            const Text(
              'برای نسخه واقعی، پس از ثبت اولیه توصیه می‌شود بیمار رمز عبور مستقل دریافت/تغییر دهد.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 11, color: AppColors.muted),
            ),
          ],
        ),
      ),
    );
  }
}

class RegisterPage extends StatefulWidget {
  const RegisterPage({super.key});
  @override
  State<RegisterPage> createState() => _RegisterPageState();
}

class _RegisterPageState extends State<RegisterPage> {
  final first = TextEditingController();
  final last = TextEditingController();
  final mobile = TextEditingController();
  final nationalId = TextEditingController();
  bool agree = false;

  @override
  void dispose() {
    first.dispose();
    last.dispose();
    mobile.dispose();
    nationalId.dispose();
    super.dispose();
  }

  void register() {
    final f = first.text.trim();
    final l = last.text.trim();
    final m = mobile.text.trim();
    final n = nationalId.text.trim();

    if (f.isEmpty || l.isEmpty || m.length < 10 || n.length != 10) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('نام، نام خانوادگی، موبایل و کد ملی را کامل کنید.')),
      );
      return;
    }
    if (!agree) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('لطفاً شرایط استفاده و ثبت اطلاعات را تایید کنید.')),
      );
      return;
    }

    currentPatient = PatientIdentity(
      firstName: f,
      lastName: l,
      mobile: m,
      nationalId: n,
    );

    Navigator.pushReplacement(
      context,
      MaterialPageRoute(builder: (_) => const ClinicLinkPage()),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'ایجاد حساب بیمار',
          style: TextStyle(fontWeight: FontWeight.w900),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(18, 8, 18, 28),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(18),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: const [
                  Text(
                    'ثبت‌نام بدون OTP',
                    style: TextStyle(fontSize: 19, fontWeight: FontWeight.w900),
                  ),
                  SizedBox(height: 7),
                  Text(
                    'شماره موبایل شناسه ورود و کد ملی رمز اولیه حساب خواهد بود. کد ملی همچنین شناسه اصلی پرونده بیمار است.',
                    style: TextStyle(color: AppColors.muted, height: 1.6),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 14),
          TextField(
            controller: first,
            decoration: const InputDecoration(
              labelText: 'نام',
              prefixIcon: Icon(Icons.person_outline_rounded),
            ),
          ),
          const SizedBox(height: 10),
          TextField(
            controller: last,
            decoration: const InputDecoration(
              labelText: 'نام خانوادگی',
              prefixIcon: Icon(Icons.badge_outlined),
            ),
          ),
          const SizedBox(height: 10),
          TextField(
            controller: mobile,
            keyboardType: TextInputType.phone,
            decoration: const InputDecoration(
              labelText: 'شماره موبایل',
              prefixIcon: Icon(Icons.phone_outlined),
            ),
          ),
          const SizedBox(height: 10),
          TextField(
            controller: nationalId,
            keyboardType: TextInputType.number,
            maxLength: 10,
            decoration: const InputDecoration(
              labelText: 'کد ملی',
              prefixIcon: Icon(Icons.fingerprint_rounded),
              counterText: '',
            ),
          ),
          const SizedBox(height: 8),
          CheckboxListTile(
            value: agree,
            onChanged: (v) => setState(() => agree = v ?? false),
            contentPadding: EdgeInsets.zero,
            title: const Text(
              'ثبت اطلاعات برای تشکیل پرونده و هماهنگی کلینیک را تایید می‌کنم.',
              style: TextStyle(fontSize: 13),
            ),
            controlAffinity: ListTileControlAffinity.leading,
          ),
          const SizedBox(height: 8),
          SizedBox(
            height: 52,
            child: FilledButton.icon(
              onPressed: register,
              icon: const Icon(Icons.check_circle_outline_rounded),
              label: const Text('ایجاد حساب و ادامه'),
            ),
          ),
        ],
      ),
    );
  }
}

class ClinicLinkPage extends StatefulWidget {
  const ClinicLinkPage({super.key});
  @override
  State<ClinicLinkPage> createState() => _ClinicLinkPageState();
}

class _ClinicLinkPageState extends State<ClinicLinkPage> {
  final code = TextEditingController(text: 'SAFFARI');

  @override
  void dispose() {
    code.dispose();
    super.dispose();
  }

  void connect() {
    if (code.text.trim().isEmpty) return;
    Navigator.pushReplacement(
      context,
      MaterialPageRoute(builder: (_) => const AppShell()),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'اتصال به کلینیک',
          style: TextStyle(fontWeight: FontWeight.w900),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(18),
              child: Row(
                children: [
                  const CircleAvatar(
                    radius: 25,
                    backgroundColor: Color(0xFFE8F2F2),
                    child: Icon(Icons.fingerprint_rounded, color: AppColors.primary),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'شناسه پرونده بیمار',
                          style: TextStyle(color: AppColors.muted, fontSize: 12),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          currentPatient.nationalId,
                          style: const TextStyle(
                            fontSize: 19,
                            fontWeight: FontWeight.w900,
                            letterSpacing: 1.2,
                          ),
                        ),
                        const SizedBox(height: 4),
                        const Text(
                          'این کد در پرونده کلینیک به‌عنوان شناسه اصلی بیمار استفاده می‌شود.',
                          style: TextStyle(color: AppColors.muted, height: 1.4),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 18),
          const Text(
            'کلینیک دکتر صفاری را به پرونده خود متصل کنید',
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 21,
              fontWeight: FontWeight.w900,
              color: AppColors.text,
            ),
          ),
          const SizedBox(height: 8),
          const Text(
            'کد اتصال بیمار/کلینیک را از پذیرش دریافت کنید. پس از اتصال، پزشک پرونده شما را براساس کد ملی پیدا خواهد کرد.',
            textAlign: TextAlign.center,
            style: TextStyle(color: AppColors.muted, height: 1.6),
          ),
          const SizedBox(height: 20),
          TextField(
            controller: code,
            decoration: const InputDecoration(
              labelText: 'کد اتصال کلینیک',
              prefixIcon: Icon(Icons.link_rounded),
            ),
          ),
          const SizedBox(height: 14),
          SizedBox(
            height: 52,
            child: FilledButton(
              onPressed: connect,
              child: const Text('فعال‌سازی مسیر اختصاصی'),
            ),
          ),
          const SizedBox(height: 8),
          OutlinedButton.icon(
            onPressed: connect,
            icon: const Icon(Icons.qr_code_scanner_rounded),
            label: const Text('اسکن QR کلینیک'),
          ),
        ],
      ),
    );
  }
}

class AppShell extends StatefulWidget {
  const AppShell({super.key});
  @override State<AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<AppShell> {
  int index = 0;
  Disease active = Disease.migraine;

  void selectDisease(Disease d) {
    setState(() {
      active = d;
      index = 1;
    });
  }

  @override
  Widget build(BuildContext context) {
    final pages = [
      HomePage(
        disease: active,
        onDisease: selectDisease,
        onAppointment: () => showAppointment(context),
        onPreVisit: () => Navigator.push(
          context,
          MaterialPageRoute(builder: (_) => PreVisitPage(disease: active)),
        ),
      ),
      StatusPage(initialDisease: active),
      TreatmentPage(initialDisease: active),
      const RecordPage(),
      const AccountPage(),
    ];

    return Scaffold(
      body: SafeArea(child: pages[index]),
      floatingActionButton: (index == 0 || index == 1)
          ? FloatingActionButton.extended(
              onPressed: () => showAppointment(context),
              backgroundColor: AppColors.primary,
              foregroundColor: Colors.white,
              icon: const Icon(Icons.calendar_month_rounded),
              label: const Text('درخواست نوبت'),
            )
          : null,
      bottomNavigationBar: NavigationBar(
        selectedIndex: index,
        onDestinationSelected: (v) => setState(() => index = v),
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.home_outlined),
            selectedIcon: Icon(Icons.home_rounded),
            label: 'خانه',
          ),
          NavigationDestination(
            icon: Icon(Icons.insights_outlined),
            selectedIcon: Icon(Icons.insights_rounded),
            label: 'وضعیت من',
          ),
          NavigationDestination(
            icon: Icon(Icons.medication_outlined),
            selectedIcon: Icon(Icons.medication_rounded),
            label: 'درمان',
          ),
          NavigationDestination(
            icon: Icon(Icons.folder_outlined),
            selectedIcon: Icon(Icons.folder_rounded),
            label: 'پرونده',
          ),
          NavigationDestination(
            icon: Icon(Icons.person_outline_rounded),
            selectedIcon: Icon(Icons.person_rounded),
            label: 'حساب',
          ),
        ],
      ),
    );
  }
}

class HomePage extends StatelessWidget {
  final Disease disease;
  final ValueChanged<Disease> onDisease;
  final VoidCallback onAppointment;
  final VoidCallback onPreVisit;

  const HomePage({
    super.key,
    required this.disease,
    required this.onDisease,
    required this.onAppointment,
    required this.onPreVisit,
  });

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(18, 20, 18, 110),
      children: [
        const Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'سلام محمدحسین 👋',
                    style: TextStyle(
                      fontSize: 24,
                      fontWeight: FontWeight.w900,
                      color: AppColors.text,
                    ),
                  ),
                  SizedBox(height: 4),
                  Text(
                    'مسیر اختصاصی کلینیک برای شما فعال است.',
                    style: TextStyle(color: AppColors.muted),
                  ),
                ],
              ),
            ),
            CircleAvatar(
              radius: 25,
              backgroundColor: AppColors.primary,
              child: Icon(Icons.person_rounded, color: Colors.white),
            ),
          ],
        ),
        const SizedBox(height: 16),
        Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [AppColors.dark, AppColors.primary],
            ),
            borderRadius: BorderRadius.circular(24),
          ),
          child: const Row(
            children: [
              Icon(Icons.star_rounded, color: Colors.white, size: 36),
              SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '⭐ بیمار تحت پیگیری دکتر صفاری',
                      style: TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    SizedBox(height: 5),
                    Text(
                      'هماهنگی نوبت، پیگیری درمان و گزارش پیش از ویزیت.',
                      style: TextStyle(color: Colors.white, height: 1.45),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 18),
        const SectionTitle('بیماری‌های تحت پیگیری'),
        const SizedBox(height: 10),
        SizedBox(
          height: 100,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: Disease.values.length,
            separatorBuilder: (_, __) => const SizedBox(width: 9),
            itemBuilder: (_, i) {
              final d = Disease.values[i];
              final selected = d == disease;
              return InkWell(
                onTap: () => onDisease(d),
                borderRadius: BorderRadius.circular(20),
                child: Container(
                  width: 120,
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: selected ? AppColors.primary : Colors.white,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(
                      color: selected ? AppColors.primary : AppColors.line,
                    ),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Icon(
                        d.icon,
                        color: selected ? Colors.white : AppColors.primary,
                      ),
                      Text(
                        d.shortName,
                        maxLines: 2,
                        style: TextStyle(
                          color: selected ? Colors.white : AppColors.text,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        ),
        const SizedBox(height: 18),
        InfoCard(
          icon: Icons.calendar_month_rounded,
          title: 'نوبت بعدی',
          value: 'سه‌شنبه • ۱۷:۳۰',
          note: 'ویزیت پیگیری در کلینیک',
          onTap: onAppointment,
        ),
        const SizedBox(height: 10),
        InfoCard(
          icon: disease.icon,
          title: 'وضعیت فعال',
          value: disease.shortName,
          note: diseaseSummary(disease),
          onTap: () => onDisease(disease),
        ),
        const SizedBox(height: 10),
        InfoCard(
          icon: Icons.assignment_rounded,
          title: 'گزارش قبل از ویزیت',
          value: 'حدود ۳ دقیقه',
          note: 'ثبت تغییرات اخیر برای مرور پزشک',
          onTap: onPreVisit,
        ),
        const SizedBox(height: 18),
        const SectionTitle('کارهای امروز'),
        const SizedBox(height: 8),
        const TaskTile(
          title: 'ثبت علائم امروز',
          subtitle: 'تکمیل شده',
          done: true,
        ),
        const SizedBox(height: 8),
        const TaskTile(
          title: 'بررسی داروهای امروز',
          subtitle: 'صبح و شب',
          done: false,
        ),
        const SizedBox(height: 18),
        const SectionTitle('محتوای شخصی‌سازی‌شده'),
        const SizedBox(height: 8),
        Card(
          child: ListTile(
            contentPadding: const EdgeInsets.all(14),
            leading: CircleAvatar(
              backgroundColor: Colors.white,
              child: Icon(disease.icon, color: AppColors.primary),
            ),
            title: Text(
              articleTitle(disease),
              style: const TextStyle(fontWeight: FontWeight.w900),
            ),
            subtitle: const Text(
              'مقاله آموزشی متناسب با بیماری فعال شما.',
              style: TextStyle(height: 1.4),
            ),
            trailing: const Icon(Icons.chevron_left_rounded),
            onTap: () => showArticle(context, disease),
          ),
        ),
      ],
    );
  }
}

class StatusPage extends StatefulWidget {
  final Disease initialDisease;
  const StatusPage({super.key, required this.initialDisease});
  @override State<StatusPage> createState() => _StatusPageState();
}

class _StatusPageState extends State<StatusPage> {
  late Disease disease;

  @override
  void initState() {
    super.initState();
    disease = widget.initialDisease;
  }

  @override
  Widget build(BuildContext context) {
    final metrics = diseaseMetrics(disease);
    return ListView(
      padding: const EdgeInsets.fromLTRB(18, 20, 18, 110),
      children: [
        Text(
          'وضعیت من',
          style: const TextStyle(
            fontSize: 24,
            fontWeight: FontWeight.w900,
            color: AppColors.text,
          ),
        ),
        const SizedBox(height: 4),
        Text(disease.title, style: const TextStyle(color: AppColors.muted)),
        const SizedBox(height: 14),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: Disease.values.map((d) {
              final selected = d == disease;
              return Padding(
                padding: const EdgeInsets.only(left: 8),
                child: ChoiceChip(
                  label: Text(d.shortName),
                  selected: selected,
                  onSelected: (_) => setState(() => disease = d),
                ),
              );
            }).toList(),
          ),
        ),
        const SizedBox(height: 16),
        GridView.count(
          crossAxisCount: 2,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          mainAxisSpacing: 10,
          crossAxisSpacing: 10,
          childAspectRatio: 1.35,
          children: metrics.map((m) {
            return MetricCard(label: m.label, value: m.value, icon: m.icon);
          }).toList(),
        ),
        const SizedBox(height: 14),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'روند اخیر',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900),
                ),
                const SizedBox(height: 7),
                Text(
                  trendText(disease),
                  style: const TextStyle(color: AppColors.muted, height: 1.65),
                ),
                const SizedBox(height: 14),
                SizedBox(height: 150, child: MiniChart(values: diseaseChart(disease))),
              ],
            ),
          ),
        ),
        const SizedBox(height: 10),
        Card(
          child: ListTile(
            leading: const Icon(Icons.history_rounded, color: AppColors.primary),
            title: const Text(
              'آخرین ارزیابی',
              style: TextStyle(fontWeight: FontWeight.w900),
            ),
            subtitle: const Text('۱۴۰۵/۰۷/۰۷ • ثبت‌شده در مسیر پیگیری'),
            trailing: const Icon(Icons.chevron_left_rounded),
            onTap: () => showVisitSummary(context, disease),
          ),
        ),
        const SizedBox(height: 10),
        const Card(
          child: ListTile(
            leading: Icon(Icons.info_outline_rounded, color: AppColors.warning),
            title: Text(
              'یادآوری',
              style: TextStyle(fontWeight: FontWeight.w900),
            ),
            subtitle: Text('داده‌های اپ برای کمک به پیگیری هستند و جایگزین تصمیم پزشکی نیستند.'),
          ),
        ),
      ],
    );
  }
}

class TreatmentPage extends StatefulWidget {
  final Disease initialDisease;
  const TreatmentPage({super.key, required this.initialDisease});
  @override State<TreatmentPage> createState() => _TreatmentPageState();
}

class _TreatmentPageState extends State<TreatmentPage> {
  late Disease disease;
  final Set<int> completed = {0};

  @override
  void initState() {
    super.initState();
    disease = widget.initialDisease;
  }

  @override
  Widget build(BuildContext context) {
    final meds = medicines(disease);
    final tasks = treatmentTasks(disease);
    return ListView(
      padding: const EdgeInsets.fromLTRB(18, 20, 18, 110),
      children: [
        const Text(
          'برنامه درمان',
          style: TextStyle(fontSize: 24, fontWeight: FontWeight.w900, color: AppColors.text),
        ),
        const SizedBox(height: 4),
        Text(disease.title, style: const TextStyle(color: AppColors.muted)),
        const SizedBox(height: 14),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: Disease.values.map((d) {
              return Padding(
                padding: const EdgeInsets.only(left: 8),
                child: ChoiceChip(
                  label: Text(d.shortName),
                  selected: d == disease,
                  onSelected: (_) => setState(() => disease = d),
                ),
              );
            }).toList(),
          ),
        ),
        const SizedBox(height: 14),
        Card(
          child: ListTile(
            leading: const CircleAvatar(
              backgroundColor: Color(0xFFE8F2F2),
              child: Icon(Icons.medical_services_rounded, color: AppColors.primary),
            ),
            title: const Text(
              'پزشک مسئول',
              style: TextStyle(fontWeight: FontWeight.w900),
            ),
            subtitle: const Text('دکتر محمدحسین صفاری'),
            trailing: const Icon(Icons.verified_rounded, color: AppColors.success),
          ),
        ),
        const SizedBox(height: 10),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('هدف فعلی درمان', style: TextStyle(fontWeight: FontWeight.w900)),
                const SizedBox(height: 8),
                Text(
                  treatmentGoal(disease),
                  style: const TextStyle(fontSize: 16, height: 1.6),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 16),
        const SectionTitle('داروهای ثبت‌شده'),
        const SizedBox(height: 8),
        ...meds.map((m) => Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: Card(
            child: ListTile(
              leading: CircleAvatar(
                backgroundColor: disease.tint,
                child: Icon(disease.icon, color: AppColors.primary),
              ),
              title: Text(m.name, style: const TextStyle(fontWeight: FontWeight.w900)),
              subtitle: Text(m.schedule),
              trailing: const Icon(Icons.chevron_left_rounded),
              onTap: () => showMedication(context, m.name, m.schedule),
            ),
          ),
        )),
        const SizedBox(height: 8),
        const SectionTitle('وظایف درمانی'),
        const SizedBox(height: 8),
        ...List.generate(tasks.length, (i) => Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: Card(
            child: CheckboxListTile(
              value: completed.contains(i),
              onChanged: (v) => setState(() {
                if (v == true) {
                  completed.add(i);
                } else {
                  completed.remove(i);
                }
              }),
              title: Text(tasks[i].name, style: const TextStyle(fontWeight: FontWeight.w800)),
              subtitle: Text(tasks[i].desc),
              controlAffinity: ListTileControlAffinity.leading,
            ),
          ),
        )),
        const SizedBox(height: 4),
        const Text(
          'تغییرات واقعی نسخه باید از پرونده رسمی کلینیک وارد و تأیید شوند.',
          style: TextStyle(fontSize: 11, color: AppColors.muted),
        ),
      ],
    );
  }
}

class RecordPage extends StatelessWidget {
  const RecordPage({super.key});

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(18, 20, 18, 110),
      children: [
        const Text(
          'پرونده من',
          style: TextStyle(fontSize: 24, fontWeight: FontWeight.w900, color: AppColors.text),
        ),
        const SizedBox(height: 4),
        const Text(
          'مدارک، گزارش‌ها و خط زمانی پیگیری',
          style: TextStyle(color: AppColors.muted),
        ),
        const SizedBox(height: 16),
        Card(
          child: ListTile(
            leading: const Icon(Icons.folder_shared_rounded, color: AppColors.primary),
            title: const Text('خلاصه پرونده', style: TextStyle(fontWeight: FontWeight.w900)),
            subtitle: const Text('۵ ماژول بیماری • آخرین پیگیری ۱۴۰۵/۰۷/۰۷'),
            trailing: const Icon(Icons.chevron_left_rounded),
            onTap: () => showRecordSummary(context),
          ),
        ),
        const SizedBox(height: 14),
        const SectionTitle('مدارک'),
        const SizedBox(height: 8),
        const DocumentTile(title: 'MRI مغز', type: 'گزارش تصویربرداری', date: '۱۴۰۵/۰۶/۲۱', icon: Icons.image_rounded),
        const SizedBox(height: 8),
        const DocumentTile(title: 'آزمایش خون', type: 'PDF • آزمایشگاه', date: '۱۴۰۵/۰۶/۱۸', icon: Icons.science_rounded),
        const SizedBox(height: 8),
        const DocumentTile(title: 'EEG', type: 'گزارش نوار مغز', date: '۱۴۰۵/۰۵/۳۰', icon: Icons.graphic_eq_rounded),
        const SizedBox(height: 8),
        const DocumentTile(title: 'نسخه قبلی', type: 'نسخه ثبت‌شده', date: '۱۴۰۵/۰۷/۰۷', icon: Icons.receipt_long_rounded),
        const SizedBox(height: 16),
        const SectionTitle('خط زمانی'),
        const SizedBox(height: 8),
        const TimelineTile(title: 'ویزیت آخر', date: '۱۴۰۵/۰۷/۰۷', desc: 'به‌روزرسانی برنامه درمان', icon: Icons.medical_services_rounded),
        const TimelineTile(title: 'گزارش قبل از ویزیت', date: '۱۴۰۵/۰۷/۰۵', desc: 'گزارش آماده بررسی پزشک شد', icon: Icons.assignment_rounded),
        const TimelineTile(title: 'اتصال به کلینیک', date: '۱۴۰۵/۰۶/۲۱', desc: 'مسیر اختصاصی فعال شد', icon: Icons.link_rounded),
        const SizedBox(height: 8),
        OutlinedButton.icon(
          onPressed: () => showUpload(context),
          icon: const Icon(Icons.upload_file_rounded),
          label: const Text('افزودن مدرک برای بررسی'),
        ),
      ],
    );
  }
}

class AccountPage extends StatelessWidget {
  const AccountPage({super.key});

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(18, 20, 18, 110),
      children: [
        const Text(
          'حساب من',
          style: TextStyle(fontSize: 24, fontWeight: FontWeight.w900, color: AppColors.text),
        ),
        const SizedBox(height: 4),
        const Text('پروفایل و تنظیمات مسیر اختصاصی', style: TextStyle(color: AppColors.muted)),
        const SizedBox(height: 16),
        Card(
          child: ListTile(
            contentPadding: const EdgeInsets.all(14),
            leading: const CircleAvatar(
              radius: 28,
              backgroundColor: AppColors.primary,
              child: Icon(Icons.person_rounded, color: Colors.white),
            ),
            title: const Text('محمدحسین رضایی', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900)),
            subtitle: const Text('بیمار تحت پیگیری دکتر صفاری'),
          ),
        ),
        const SizedBox(height: 10),
        SettingTile(
          icon: Icons.notifications_none_rounded,
          title: 'اعلان‌ها',
          subtitle: 'یادآوری نوبت و برنامه درمان',
          onTap: () => showNotifications(context),
        ),
        const SizedBox(height: 8),
        SettingTile(
          icon: Icons.family_restroom_rounded,
          title: 'همراه / مراقب',
          subtitle: 'سطح دسترسی همراه بیمار',
          onTap: () => showCaregiver(context),
        ),
        const SizedBox(height: 8),
        SettingTile(
          icon: Icons.link_rounded,
          title: 'اتصال کلینیک',
          subtitle: 'کلینیک دکتر صفاری • فعال',
          onTap: () => ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('اتصال کلینیک فعال است.')),
          ),
        ),
        const SizedBox(height: 8),
        SettingTile(
          icon: Icons.help_outline_rounded,
          title: 'راهنمای اپ',
          subtitle: 'خانه، وضعیت، درمان، پرونده و گزارش‌ها',
          onTap: () => showHelp(context),
        ),
        const SizedBox(height: 24),
        const Center(
          child: Text(
            'Saffari NeuroCare • نسخه نمایشی بالینی',
            style: TextStyle(fontSize: 11, color: AppColors.muted),
          ),
        ),
      ],
    );
  }
}

class PreVisitPage extends StatefulWidget {
  final Disease disease;
  const PreVisitPage({super.key, required this.disease});
  @override State<PreVisitPage> createState() => _PreVisitPageState();
}

class _PreVisitPageState extends State<PreVisitPage> {
  int mood = 2;
  bool change = true;
  bool missed = false;
  final note = TextEditingController();

  @override
  void dispose() {
    note.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('گزارش قبل از ویزیت', style: TextStyle(fontWeight: FontWeight.w900))),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(18, 10, 18, 24),
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: widget.disease.tint,
              borderRadius: BorderRadius.circular(20),
            ),
            child: Row(
              children: [
                Icon(widget.disease.icon, color: AppColors.primary),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'گزارش ' + widget.disease.shortName + ' • حدود ۳ دقیقه',
                    style: const TextStyle(fontWeight: FontWeight.w900),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          const SectionTitle('وضعیت کلی اخیر'),
          const SizedBox(height: 8),
          SegmentedButton<int>(
            segments: const [
              ButtonSegment(value: 1, label: Text('بدتر')),
              ButtonSegment(value: 2, label: Text('مشابه')),
              ButtonSegment(value: 3, label: Text('بهتر')),
            ],
            selected: {mood},
            onSelectionChanged: (v) => setState(() => mood = v.first),
          ),
          const SizedBox(height: 12),
          SwitchListTile(
            value: change,
            onChanged: (v) => setState(() => change = v),
            title: const Text('تغییر قابل توجه داشته‌ام', style: TextStyle(fontWeight: FontWeight.w800)),
            subtitle: const Text('برای مرور در ویزیت'),
          ),
          SwitchListTile(
            value: missed,
            onChanged: (v) => setState(() => missed = v),
            title: const Text('دارو از برنامه خارج شده', style: TextStyle(fontWeight: FontWeight.w800)),
            subtitle: const Text('فقط برای ثبت روند درمان'),
          ),
          const SizedBox(height: 8),
          TextField(
            controller: note,
            minLines: 4,
            maxLines: 7,
            decoration: const InputDecoration(
              labelText: 'یادداشت آزاد',
              hintText: 'تغییرات، علائم یا نکته‌ای که باید در ویزیت مرور شود…',
            ),
          ),
          const SizedBox(height: 16),
          SizedBox(
            height: 52,
            child: FilledButton.icon(
              onPressed: () {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('گزارش قبل از ویزیت برای پزشک آماده شد.')),
                );
              },
              icon: const Icon(Icons.send_rounded),
              label: const Text('ثبت و ارسال'),
            ),
          ),
          const SizedBox(height: 10),
          const Text(
            'این گزارش ورودی جلسه ویزیت است؛ تصمیم‌گیری نهایی با پزشک خواهد بود.',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 11, color: AppColors.muted),
          ),
        ],
      ),
    );
  }
}

class SectionTitle extends StatelessWidget {
  final String text;
  const SectionTitle(this.text, {super.key});

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: const TextStyle(
        fontSize: 17,
        fontWeight: FontWeight.w900,
        color: AppColors.text,
      ),
    );
  }
}

class InfoCard extends StatelessWidget {
  final IconData icon;
  final String title;
  final String value;
  final String note;
  final VoidCallback onTap;

  const InfoCard({
    super.key,
    required this.icon,
    required this.title,
    required this.value,
    required this.note,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(20),
        child: Padding(
          padding: const EdgeInsets.all(15),
          child: Row(
            children: [
              CircleAvatar(
                backgroundColor: const Color(0xFFE8F2F2),
                child: Icon(icon, color: AppColors.primary),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: const TextStyle(color: AppColors.muted, fontSize: 12)),
                    const SizedBox(height: 3),
                    Text(value, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w900)),
                    const SizedBox(height: 3),
                    Text(note, style: const TextStyle(color: AppColors.muted, height: 1.35)),
                  ],
                ),
              ),
              const Icon(Icons.chevron_left_rounded),
            ],
          ),
        ),
      ),
    );
  }
}

class TaskTile extends StatelessWidget {
  final String title;
  final String subtitle;
  final bool done;
  const TaskTile({super.key, required this.title, required this.subtitle, required this.done});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: done ? const Color(0xFFEAF7F0) : const Color(0xFFFFF3DD),
          child: Icon(
            done ? Icons.check_rounded : Icons.schedule_rounded,
            color: done ? AppColors.success : AppColors.warning,
          ),
        ),
        title: Text(title, style: const TextStyle(fontWeight: FontWeight.w800)),
        subtitle: Text(subtitle),
        trailing: Icon(done ? Icons.verified_rounded : Icons.chevron_left_rounded,
            color: done ? AppColors.success : AppColors.muted),
      ),
    );
  }
}

class MetricCard extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;

  const MetricCard({
    super.key,
    required this.label,
    required this.value,
    required this.icon,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            CircleAvatar(
              radius: 17,
              backgroundColor: const Color(0xFFE8F2F2),
              child: Icon(icon, size: 17, color: AppColors.primary),
            ),
            const Spacer(),
            Text(label, style: const TextStyle(fontSize: 11, color: AppColors.muted)),
            const SizedBox(height: 4),
            Text(
              value,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900),
            ),
          ],
        ),
      ),
    );
  }
}

class MiniChart extends StatelessWidget {
  final List<double> values;
  const MiniChart({super.key, required this.values});

  @override
  Widget build(BuildContext context) {
    return CustomPaint(
      painter: ChartPainter(values),
      child: const SizedBox.expand(),
    );
  }
}

class ChartPainter extends CustomPainter {
  final List<double> values;
  ChartPainter(this.values);

  @override
  void paint(Canvas canvas, Size size) {
    if (values.length < 2) return;
    final line = Paint()
      ..color = AppColors.primary
      ..strokeWidth = 3
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;
    final fill = Paint()
      ..color = AppColors.primary.withOpacity(.08)
      ..style = PaintingStyle.fill;
    final max = values.reduce((a, b) => a > b ? a : b);
    final min = values.reduce((a, b) => a < b ? a : b);
    final range = (max - min).abs() < .1 ? 1 : max - min;
    final dx = size.width / (values.length - 1);
    final path = Path();
    for (var i = 0; i < values.length; i++) {
      final y = size.height - ((values[i] - min) / range) * (size.height - 22) - 11;
      if (i == 0) {
        path.moveTo(i * dx, y);
      } else {
        path.lineTo(i * dx, y);
      }
    }
    canvas.drawPath(path, line);
    final area = Path.from(path)
      ..lineTo(size.width, size.height)
      ..lineTo(0, size.height)
      ..close();
    canvas.drawPath(area, fill);
    for (var i = 0; i < values.length; i++) {
      final y = size.height - ((values[i] - min) / range) * (size.height - 22) - 11;
      canvas.drawCircle(
        Offset(i * dx, y),
        4,
        Paint()..color = AppColors.primary,
      );
    }
  }

  @override
  bool shouldRepaint(covariant ChartPainter oldDelegate) => true;
}

class DocumentTile extends StatelessWidget {
  final String title;
  final String type;
  final String date;
  final IconData icon;

  const DocumentTile({
    super.key,
    required this.title,
    required this.type,
    required this.date,
    required this.icon,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      child: ListTile(
        leading: Container(
          width: 45,
          height: 45,
          decoration: BoxDecoration(
            color: const Color(0xFFE8F2F2),
            borderRadius: BorderRadius.circular(14),
          ),
          child: Icon(icon, color: AppColors.primary),
        ),
        title: Text(title, style: const TextStyle(fontWeight: FontWeight.w900)),
        subtitle: Text(type + ' • ' + date),
        trailing: const Icon(Icons.open_in_new_rounded),
        onTap: () => ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('نمایش «' + title + '» آماده اتصال به فایل واقعی است.')),
        ),
      ),
    );
  }
}

class TimelineTile extends StatelessWidget {
  final String title;
  final String date;
  final String desc;
  final IconData icon;

  const TimelineTile({
    super.key,
    required this.title,
    required this.date,
    required this.desc,
    required this.icon,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: const Color(0xFFE8F2F2),
          child: Icon(icon, color: AppColors.primary),
        ),
        title: Text(title, style: const TextStyle(fontWeight: FontWeight.w900)),
        subtitle: Text(date + ' • ' + desc),
      ),
    );
  }
}

class SettingTile extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  const SettingTile({
    super.key,
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: const Color(0xFFE8F2F2),
          child: Icon(icon, color: AppColors.primary),
        ),
        title: Text(title, style: const TextStyle(fontWeight: FontWeight.w900)),
        subtitle: Text(subtitle),
        trailing: const Icon(Icons.chevron_left_rounded),
        onTap: onTap,
      ),
    );
  }
}

class Metric {
  final String label;
  final String value;
  final IconData icon;
  const Metric(this.label, this.value, this.icon);
}

class Medicine {
  final String name;
  final String schedule;
  const Medicine(this.name, this.schedule);
}

class CareTask {
  final String name;
  final String desc;
  const CareTask(this.name, this.desc);
}

String diseaseSummary(Disease d) {
  switch (d) {
    case Disease.migraine: return '۷ روز سردرد در ماه • روند نیازمند پیگیری';
    case Disease.ms: return 'علائم پایدار • MRI در پرونده ثبت شده';
    case Disease.epilepsy: return '۲ حمله اخیر • دفترچه حملات فعال';
    case Disease.parkinson: return 'حرکت و لرزش • بدون تغییر عمده';
    case Disease.cognition: return 'حافظه و ADL • ثبت منظم توصیه می‌شود';
  }
}

String articleTitle(Disease d) {
  switch (d) {
    case Disease.migraine: return 'میگرن، محرک‌ها و سبک زندگی';
    case Disease.ms: return 'ام‌اس و اصول پیگیری روزمره';
    case Disease.epilepsy: return 'ثبت حمله تشنجی و نکات ایمنی';
    case Disease.parkinson: return 'حرکت، خواب و زندگی روزمره';
    case Disease.cognition: return 'شناخت، خواب و فعالیت‌های روزمره';
  }
}

String treatmentGoal(Disease d) {
  switch (d) {
    case Disease.migraine: return 'کاهش دفعات و شدت حملات و بهبود عملکرد روزانه با پایش منظم سردرد.';
    case Disease.ms: return 'پایش علائم، MRI و پایبندی به درمان تعدیل‌کننده بیماری.';
    case Disease.epilepsy: return 'کاهش خطر حملات و ثبت الگوی حملات، محرک‌ها و مصرف دارو.';
    case Disease.parkinson: return 'حفظ تحرک، تعادل و کیفیت زندگی با ثبت علائم و پاسخ به درمان.';
    case Disease.cognition: return 'پایش حافظه، خواب، خلق و فعالیت‌های روزمره با مشارکت همراه.';
  }
}

List<Metric> diseaseMetrics(Disease d) {
  switch (d) {
    case Disease.migraine:
      return [
        const Metric('روزهای سردرد', '۷ روز / ماه', Icons.calendar_today_rounded),
        const Metric('حملات شدید', '۲ حمله', Icons.warning_amber_rounded),
        const Metric('داروی حمله', '۳ روز / ماه', Icons.medication_rounded),
        const Metric('روند', 'کمی بهتر', Icons.trending_down_rounded),
      ];
    case Disease.ms:
      return [
        const Metric('خستگی', 'متوسط', Icons.battery_3_bar_rounded),
        const Metric('راه رفتن', 'پایدار', Icons.directions_walk_rounded),
        const Metric('MRI', 'آخرین: ۱۴۰۵/۰۶', Icons.image_rounded),
        const Metric('مصرف دارو', 'منظم', Icons.verified_rounded),
      ];
    case Disease.epilepsy:
      return [
        const Metric('حملات اخیر', '۲ / ماه', Icons.flash_on_rounded),
        const Metric('مدت معمول', 'کمتر از ۲ دقیقه', Icons.timer_outlined),
        const Metric('هوشیاری', 'متغیر', Icons.visibility_rounded),
        const Metric('ثبت محرک', 'فعال', Icons.fact_check_rounded),
      ];
    case Disease.parkinson:
      return [
        const Metric('لرزش', 'متوسط', Icons.vibration_rounded),
        const Metric('سفتی', 'خفیف', Icons.accessibility_new_rounded),
        const Metric('تعادل', 'قابل قبول', Icons.balance_rounded),
        const Metric('خواب', 'نیازمند ثبت', Icons.bedtime_rounded),
      ];
    case Disease.cognition:
      return [
        const Metric('حافظه', 'نیازمند پیگیری', Icons.psychology_alt_rounded),
        const Metric('خلق', 'پایدار', Icons.sentiment_satisfied_alt_rounded),
        const Metric('خواب', 'متوسط', Icons.bedtime_rounded),
        const Metric('ADL', 'با کمک همراه', Icons.home_rounded),
      ];
  }
}

List<Medicine> medicines(Disease d) {
  switch (d) {
    case Disease.migraine:
      return const [
        Medicine('داروی پیشگیری', 'طبق نسخه • روزانه'),
        Medicine('داروی حمله', 'در شروع حمله • طبق دستور پزشک'),
      ];
    case Disease.ms:
      return const [
        Medicine('درمان تعدیل‌کننده بیماری', 'طبق برنامه نسخه'),
        Medicine('داروی علامتی', 'طبق دستور پزشک'),
      ];
    case Disease.epilepsy:
      return const [
        Medicine('داروی ضدتشنج', 'طبق زمان‌بندی ثبت‌شده'),
        Medicine('داروی نجات', 'فقط در شرایط تعیین‌شده توسط پزشک'),
      ];
    case Disease.parkinson:
      return const [
        Medicine('داروی کنترل علائم حرکتی', 'ساعت مصرف در برنامه درمان'),
        Medicine('داروی کمکی', 'طبق نسخه'),
      ];
    case Disease.cognition:
      return const [
        Medicine('داروی شناختی', 'طبق نسخه و زمان‌بندی'),
        Medicine('داروی همراه', 'طبق دستور پزشک'),
      ];
  }
}

List<CareTask> treatmentTasks(Disease d) {
  switch (d) {
    case Disease.migraine:
      return const [
        CareTask('ثبت سردرد امروز', 'شدت، مدت، محرک و داروی حمله'),
        CareTask('ثبت خواب', 'ساعت خواب و بیداری'),
        CareTask('مرور مصرف داروی حمله', 'برای ویزیت بعدی'),
      ];
    case Disease.ms:
      return const [
        CareTask('ثبت خستگی و توان حرکتی', 'وضعیت امروز'),
        CareTask('مرور برنامه دارویی', 'مطابق نسخه'),
        CareTask('آماده‌سازی MRI / مدارک', 'در صورت وجود مدرک جدید'),
      ];
    case Disease.epilepsy:
      return const [
        CareTask('ثبت حمله', 'زمان، مدت، هوشیاری و پس از حمله'),
        CareTask('ثبت محرک احتمالی', 'خواب، تب، استرس یا عوامل دیگر'),
        CareTask('مرور داروها', 'عدم جاافتادگی نوبت مصرف'),
      ];
    case Disease.parkinson:
      return const [
        CareTask('ثبت لرزش و حرکت', 'صبح و عصر'),
        CareTask('ثبت خواب و خلق', 'برای مرور در ویزیت'),
        CareTask('ثبت افتادن / عدم تعادل', 'در صورت وقوع'),
      ];
    case Disease.cognition:
      return const [
        CareTask('ثبت وضعیت حافظه', 'با کمک همراه در صورت نیاز'),
        CareTask('ثبت خواب و خلق', 'روزانه'),
        CareTask('مرور فعالیت‌های روزمره', 'غذا، لباس، دارو و کارهای معمول'),
      ];
  }
}

String trendText(Disease d) {
  switch (d) {
    case Disease.migraine: return 'در چهار هفته اخیر تعداد روزهای سردرد از ۹ به ۷ رسیده است؛ شدت حملات باید در ویزیت مرور شود.';
    case Disease.ms: return 'علائم روزمره پایدار گزارش شده و MRI قبلی برای بررسی روند در پرونده وجود دارد.';
    case Disease.epilepsy: return 'دو رخداد اخیر ثبت شده‌اند؛ زمان، مدت و علائم پس از حمله برای مرور پزشک نگهداری می‌شوند.';
    case Disease.parkinson: return 'لرزش و حرکت در محدوده ثبت‌شده هستند؛ ثبت خواب و تعادل برای ویزیت مفید است.';
    case Disease.cognition: return 'ثبت منظم حافظه، خواب و فعالیت‌های روزانه به مقایسه روند کمک می‌کند.';
  }
}

List<double> diseaseChart(Disease d) {
  switch (d) {
    case Disease.migraine: return [9, 8, 8, 7, 7, 6, 7];
    case Disease.ms: return [6, 6, 5, 6, 5, 5, 5];
    case Disease.epilepsy: return [4, 3, 4, 2, 3, 2, 2];
    case Disease.parkinson: return [5, 5, 4, 5, 4, 4, 4];
    case Disease.cognition: return [3, 4, 4, 5, 5, 5, 6];
  }
}

void showAppointment(BuildContext context) {
  showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (_) => const AppointmentSheet(),
  );
}

class AppointmentSheet extends StatefulWidget {
  const AppointmentSheet({super.key});
  @override State<AppointmentSheet> createState() => _AppointmentSheetState();
}

class _AppointmentSheetState extends State<AppointmentSheet> {
  String type = 'پیگیری';

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: EdgeInsets.fromLTRB(
          18,
          8,
          18,
          MediaQuery.of(context).viewInsets.bottom + 18,
        ),
        child: ListView(
          shrinkWrap: true,
          children: [
            const Text(
              'درخواست نوبت',
              style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900),
            ),
            const SizedBox(height: 7),
            const Text(
              'درخواست ثبت می‌شود و پذیرش کلینیک زمان مناسب را هماهنگ می‌کند.',
              style: TextStyle(color: AppColors.muted),
            ),
            const SizedBox(height: 14),
            DropdownButtonFormField<String>(
              value: type,
              decoration: const InputDecoration(labelText: 'نوع مراجعه'),
              items: const [
                DropdownMenuItem(value: 'پیگیری', child: Text('ویزیت پیگیری')),
                DropdownMenuItem(value: 'اولین ویزیت', child: Text('اولین ویزیت')),
                DropdownMenuItem(value: 'بررسی مدارک', child: Text('بررسی MRI / آزمایش')),
                DropdownMenuItem(value: 'مشکل جدید', child: Text('مشکل جدید')),
              ],
              onChanged: (v) => setState(() => type = v ?? type),
            ),
            const SizedBox(height: 12),
            const TextField(
              minLines: 2,
              maxLines: 4,
              decoration: InputDecoration(
                labelText: 'توضیح کوتاه',
                hintText: 'موضوعی که پذیرش بهتر است بداند…',
              ),
            ),
            const SizedBox(height: 14),
            SizedBox(
              height: 52,
              child: FilledButton.icon(
                onPressed: () {
                  Navigator.pop(context);
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('درخواست «' + type + '» ثبت شد.')),
                  );
                },
                icon: const Icon(Icons.send_rounded),
                label: const Text('ثبت درخواست'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

void showArticle(BuildContext context, Disease disease) {
  showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (_) => SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(18, 8, 18, 25),
        child: Wrap(
          runSpacing: 12,
          children: [
            Text(
              articleTitle(disease),
              style: const TextStyle(fontSize: 21, fontWeight: FontWeight.w900),
            ),
            Text(
              'محتوای آموزشی متناسب با ماژول ' + disease.shortName + ' در مسیر NeuroCare.',
              style: const TextStyle(color: AppColors.muted, height: 1.65),
            ),
            const Text(
              'در نسخه عملیاتی، این بخش می‌تواند مقاله‌های تاییدشده وب‌سایت دکتر صفاری را بر اساس بیماری و مرحله پیگیری شخصی‌سازی کند.',
              style: TextStyle(height: 1.7),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('بستن'),
            ),
          ],
        ),
      ),
    ),
  );
}

void showMedication(BuildContext context, String title, String note) {
  showDialog(
    context: context,
    builder: (_) => AlertDialog(
      title: Text(title),
      content: Text(note + '\n\nجزئیات دوز و تغییر نسخه باید از نسخه رسمی کلینیک خوانده شوند.'),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: const Text('بستن')),
      ],
    ),
  );
}

void showVisitSummary(BuildContext context, Disease disease) {
  showDialog(
    context: context,
    builder: (_) => AlertDialog(
      title: const Text('خلاصه آخرین ویزیت'),
      content: Text(
        'موضوع پیگیری: ' + disease.title + '\n\n'
        'وضعیت کلی: پایدار با نیاز به ادامه ثبت علائم.\n'
        'اقدام بعدی: ادامه برنامه درمان و تکمیل گزارش قبل از ویزیت.',
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: const Text('بستن')),
      ],
    ),
  );
}

void showRecordSummary(BuildContext context) {
  showDialog(
    context: context,
    builder: (dialogContext) => AlertDialog(
      title: const Text('خلاصه پرونده'),
      content: const Text(
        'پنج ماژول قابل پیگیری فعال هستند: میگرن، ام‌اس، صرع، پارکینسون و اختلالات شناختی.\n\n'
        'مدارک بیمار و گزارش‌های قبل از ویزیت در نسخه عملیاتی باید به پرونده رسمی کلینیک متصل شوند.',
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(dialogContext),
          child: const Text('بستن'),
        ),
      ],
    ),
  );
}

void showUpload(BuildContext context) {
  showModalBottomSheet(
    context: context,
    showDragHandle: true,
    builder: (_) => SafeArea(
      child: Wrap(
        children: [
          const Padding(
            padding: EdgeInsets.fromLTRB(18, 8, 18, 4),
            child: Text('افزودن مدرک', style: TextStyle(fontSize: 21, fontWeight: FontWeight.w900)),
          ),
          ListTile(
            leading: const Icon(Icons.photo_library_rounded),
            title: const Text('انتخاب تصویر'),
            onTap: () => Navigator.pop(context),
          ),
          ListTile(
            leading: const Icon(Icons.picture_as_pdf_rounded),
            title: const Text('انتخاب PDF'),
            onTap: () => Navigator.pop(context),
          ),
          const Padding(
            padding: EdgeInsets.fromLTRB(18, 0, 18, 22),
            child: Text(
              'در build عملیاتی، این بخش به فضای ذخیره‌سازی امن متصل می‌شود.',
              style: TextStyle(fontSize: 11, color: AppColors.muted),
            ),
          ),
        ],
      ),
    ),
  );
}

void showNotifications(BuildContext context) {
  showModalBottomSheet(
    context: context,
    showDragHandle: true,
    builder: (_) => const SafeArea(
      child: Padding(
        padding: EdgeInsets.fromLTRB(18, 8, 18, 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('اعلان‌ها', style: TextStyle(fontSize: 21, fontWeight: FontWeight.w900)),
            SizedBox(height: 8),
            ListTile(
              leading: Icon(Icons.calendar_month_rounded, color: AppColors.primary),
              title: Text('یادآوری نوبت'),
              subtitle: Text('سه‌شنبه ساعت ۱۷:۳۰'),
            ),
            ListTile(
              leading: Icon(Icons.assignment_rounded, color: AppColors.primary),
              title: Text('گزارش قبل از ویزیت'),
              subtitle: Text('برای ویزیت بعدی آماده تکمیل است.'),
            ),
          ],
        ),
      ),
    ),
  );
}

void showCaregiver(BuildContext context) {
  showDialog(
    context: context,
    builder: (_) => AlertDialog(
      title: const Text('همراه / مراقب'),
      content: const Text(
        'در نسخه عملیاتی می‌توان دسترسی همراه را با سطح دسترسی مشخص فعال کرد؛ مانند مشاهده نوبت، ثبت علائم و کمک در گزارش‌های شناختی.',
      ),
      actions: [
        FilledButton(onPressed: () => Navigator.pop(context), child: const Text('متوجه شدم')),
      ],
    ),
  );
}

void showHelp(BuildContext context) {
  showDialog(
    context: context,
    builder: (dialogContext) => AlertDialog(
      title: const Text('راهنمای اپ'),
      content: const Text(
        'از نوار پایین بین خانه، وضعیت، درمان، پرونده و حساب جابه‌جا شوید.\n\n'
        'در خانه بیماری فعال را تغییر دهید.\n'
        'گزارش قبل از ویزیت برای مرور پزشک طراحی شده است.',
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(dialogContext),
          child: const Text('بستن'),
        ),
      ],
    ),
  );
}
