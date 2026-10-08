import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/foundation.dart';

enum SiteDisease { migraine, ms, epilepsy, parkinson, cognition }

extension SiteDiseaseX on SiteDisease {
  String get searchTerm {
    switch (this) {
      case SiteDisease.migraine:
        return 'میگرن سردرد';
      case SiteDisease.ms:
        return 'ام اس';
      case SiteDisease.epilepsy:
        return 'صرع تشنج';
      case SiteDisease.parkinson:
        return 'پارکینسون';
      case SiteDisease.cognition:
        return 'آلزایمر اختلالات شناختی';
    }
  }

  String get label {
    switch (this) {
      case SiteDisease.migraine:
        return 'میگرن';
      case SiteDisease.ms:
        return 'ام‌اس';
      case SiteDisease.epilepsy:
        return 'صرع';
      case SiteDisease.parkinson:
        return 'پارکینسون';
      case SiteDisease.cognition:
        return 'اختلالات شناختی';
    }
  }
}

class SiteArticle {
  final String title;
  final String url;
  final String date;
  final bool live;

  const SiteArticle({
    required this.title,
    required this.url,
    required this.date,
    required this.live,
  });
}

class SiteContentService {
  SiteContentService._();

  static const String baseUrl = 'https://mhsaffari.ir/';
  static const String appointmentUrl =
      'https://axon.me/hcps/130934-mohammad-hossein-safari-mohammadabadi/';

  static final Map<SiteDisease, List<SiteArticle>> _cache = {};

  static Uri searchUri(String query) {
    return Uri.https('mhsaffari.ir', '/', <String, String>{'s': query});
  }

  static Uri _apiUri(String searchTerm) {
    final params = <String, String>{
      'per_page': '8',
      'search': searchTerm,
      '_fields': 'id,date,link,title',
    };
    return Uri.https('mhsaffari.ir', '/wp-json/wp/v2/posts', params);
  }

  static Future<List<SiteArticle>> fetchArticles(SiteDisease disease) async {
    final cached = _cache[disease];
    if (cached != null) return cached;

    try {
      final client = HttpClient()
        ..connectionTimeout = const Duration(seconds: 5);
      final request = await client
          .getUrl(_apiUri(disease.searchTerm))
          .timeout(const Duration(seconds: 6));
      request.headers.set(HttpHeaders.acceptHeader, 'application/json');
      request.headers.set(
        HttpHeaders.userAgentHeader,
        'SaffariNeuroCare/1.0 (mobile app)',
      );

      final response =
          await request.close().timeout(const Duration(seconds: 8));
      final raw = await response.transform(utf8.decoder).join();
      client.close(force: true);

      if (response.statusCode >= 200 && response.statusCode < 300) {
        final decoded = jsonDecode(raw);
        if (decoded is List) {
          final articles = decoded
              .whereType<Map<String, dynamic>>()
              .map((item) {
                final title = item['title'];
                final titleValue = title is Map ? title['rendered'] : null;
                return SiteArticle(
                  title: _cleanHtml(
                    titleValue?.toString() ??
                        'مقاله در وب‌سایت دکتر صفاری',
                  ),
                  url: item['link']?.toString() ??
                      searchUri(disease.searchTerm).toString(),
                  date: _formatDate(item['date']?.toString()),
                  live: true,
                );
              })
              .where((article) => article.url.isNotEmpty)
              .toList();

          if (articles.isNotEmpty) {
            _cache[disease] = articles;
            return articles;
          }
        }
      }
    } catch (e) {
      debugPrint('Site article fetch failed: $e');
    }

    final fallback = <SiteArticle>[
      SiteArticle(
        title:
            'مشاهده مطالب مرتبط با ${disease.label} در وب‌سایت دکتر صفاری',
        url: searchUri(disease.searchTerm).toString(),
        date: 'جستجوی زنده در سایت',
        live: false,
      ),
    ];
    _cache[disease] = fallback;
    return fallback;
  }

  static String _cleanHtml(String value) {
    var text = value.replaceAll(RegExp(r'<[^>]*>'), ' ');
    const entities = <String, String>{
      '&amp;': '&',
      '&quot;': '"',
      '&#039;': "'",
      '&#8217;': '’',
      '&#8220;': '“',
      '&#8221;': '”',
      '&nbsp;': ' ',
    };
    entities.forEach((key, replacement) {
      text = text.replaceAll(key, replacement);
    });
    return text.replaceAll(RegExp(r'\s+'), ' ').trim();
  }

  static String _formatDate(String? value) {
    if (value == null || value.length < 10) {
      return 'در سایت دکتر صفاری';
    }
    return value.substring(0, 10).replaceAll('-', '/');
  }
}
