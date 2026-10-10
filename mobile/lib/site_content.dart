import 'package:flutter/foundation.dart';

enum SiteDisease { migraine, ms, epilepsy, parkinson, cognition }

extension SiteDiseaseX on SiteDisease {
  String get label {
    switch (this) {
      case SiteDisease.migraine: return 'میگرن و سردرد';
      case SiteDisease.ms: return 'ام‌اس';
      case SiteDisease.epilepsy: return 'صرع و تشنج';
      case SiteDisease.parkinson: return 'پارکینسون';
      case SiteDisease.cognition: return 'حافظه و اختلالات شناختی';
    }
  }

  String get archiveUrl {
    switch (this) {
      case SiteDisease.migraine:
        return 'https://mhsaffari.ir/articles-migraine-headache.html';
      case SiteDisease.ms:
        return 'https://mhsaffari.ir/articles-ms.html';
      case SiteDisease.epilepsy:
      case SiteDisease.parkinson:
      case SiteDisease.cognition:
        return 'https://mhsaffari.ir/articles-neurology.html';
    }
  }

  List<SiteArticle> get articles {
    switch (this) {
      case SiteDisease.migraine:
        return const [
          SiteArticle('میگرن: علائم، تشخیص و درمان', 'https://mhsaffari.ir/articles/migraine/migraine-symptoms-diagnosis-treatment.html'),
          SiteArticle('تغذیه، رژیم و سبک زندگی در میگرن', 'https://mhsaffari.ir/articles/migraine/migraine-nutrition-diet-lifestyle.html'),
          SiteArticle('درمان جامع میگرن', 'https://mhsaffari.ir/articles/migraine/migraine-treatment-comprehensive-saffari.html'),
          SiteArticle('سردرد چیست؟ انواع و علت‌ها', 'https://mhsaffari.ir/articles/migraine/headache-what-is-types-causes.html'),
          SiteArticle('بوتاکس در میگرن مزمن', 'https://mhsaffari.ir/articles/migraine/migraine-botox-chronic.html'),
          SiteArticle('نورالژی عصب سه‌قلو', 'https://mhsaffari.ir/articles/migraine/trigeminal-neuralgia-symptoms-causes-diagnosis-treatment.html'),
        ];
      case SiteDisease.ms:
        return const [
          SiteArticle('بیماری ام‌اس چیست؟', 'https://mhsaffari.ir/articles/ms/multiple-sclerosis-ms.html'),
          SiteArticle('درمان‌های جدید ام‌اس', 'https://mhsaffari.ir/articles/ms/ms-treatment-latest-guideline.html'),
          SiteArticle('تغذیه، رژیم و استرس در ام‌اس', 'https://mhsaffari.ir/articles/ms/ms-nutrition-diet-stress.html'),
          SiteArticle('خستگی در ام‌اس', 'https://mhsaffari.ir/articles/ms/ms-fatigue.html'),
          SiteArticle('عود ام‌اس و شبه‌عود', 'https://mhsaffari.ir/articles/ms/ms-relapse-what-is-pseudo-relapse.html'),
          SiteArticle('گزگز و بی‌حسی دست و پا', 'https://mhsaffari.ir/articles/ms/numbness-tingling-hands-feet.html'),
        ];
      case SiteDisease.epilepsy:
        return const [
          SiteArticle('تشنج و صرع: علائم، علت‌ها و موارد اورژانسی', 'https://mhsaffari.ir/articles/neurology/seizure-what-is-difference-epilepsy-symptoms-causes-diagnosis-emergency.html'),
          SiteArticle('سرگیجه: علت‌ها و تشخیص', 'https://mhsaffari.ir/articles/neurology/vertigo-causes-symptoms-diagnosis-treatment.html'),
          SiteArticle('سکته مغزی: علائم و پیشگیری', 'https://mhsaffari.ir/articles/neurology/stroke-cva-symptoms-types-causes-treatment-prevention.html'),
        ];
      case SiteDisease.parkinson:
        return const [
          SiteArticle('پارکینسون چیست؟ علائم، تشخیص و درمان', 'https://mhsaffari.ir/articles/neurology/parkinson.html'),
          SiteArticle('لرزش دست: انواع و علت‌ها', 'https://mhsaffari.ir/articles/neurology/hand-tremor-tremor-causes-types-diagnosis-treatment.html'),
          SiteArticle('فراموشی، آلزایمر و اختلالات شناختی', 'https://mhsaffari.ir/articles/neurology/forgetfulness-alzheimer-dementia-parkinson-transient-global-amnesia.html'),
          SiteArticle('سندرم پای بی‌قرار', 'https://mhsaffari.ir/articles/neurology/restless-legs-syndrome.html'),
        ];
      case SiteDisease.cognition:
        return const [
          SiteArticle('فراموشی، آلزایمر و اختلالات شناختی', 'https://mhsaffari.ir/articles/neurology/forgetfulness-alzheimer-dementia-parkinson-transient-global-amnesia.html'),
          SiteArticle('پارکینسون چیست؟', 'https://mhsaffari.ir/articles/neurology/parkinson.html'),
          SiteArticle('لرزش دست: انواع و علت‌ها', 'https://mhsaffari.ir/articles/neurology/hand-tremor-tremor-causes-types-diagnosis-treatment.html'),
        ];
    }
  }
}

class SiteArticle {
  final String title;
  final String url;
  const SiteArticle(this.title, this.url);
}

class SiteContentService {
  SiteContentService._();

  static const String baseUrl = 'https://mhsaffari.ir/';
  static const String logoUrl =
      'https://mhsaffari.ir/images/logo-dr-mohammad-hosein-saffari-transparent.png';
  static const String appointmentUrl =
      'https://axon.me/hcps/130934-mohammad-hossein-safari-mohammadabadi/';

  static Future<List<SiteArticle>> fetchArticles(SiteDisease disease) async {
    // The supplied archive is a static HTML site, not a WordPress posts API.
    // These links are mapped from actual article paths in the supplied ZIP.
    return disease.articles;
  }

  static Uri searchUri(SiteDisease disease) => Uri.parse(disease.archiveUrl);

  static void logLinkOpened(String url) {
    debugPrint('Opening Saffari website article: $url');
  }
}
