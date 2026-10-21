import 'dart:convert';
import 'dart:io';

class SaffariApiException implements Exception {
  final String message;
  const SaffariApiException(this.message);
  @override
  String toString() => message;
}

class SaffariApi {
  SaffariApi._();

  static String? sessionToken;

  static const String baseUrl = String.fromEnvironment(
    'SAFFARI_API_BASE_URL',
    defaultValue: 'https://hiiwexmjrwjaehsvxnvz.supabase.co/functions/v1/neurocare-api/v1',
  );
  static const String publishableKey = String.fromEnvironment(
    'SUPABASE_PUBLISHABLE_KEY',
    defaultValue: 'sb_publishable_86mQsVOsDK92vf9DAGXPFg_-d2OQlWs',
  );

  static Future<Map<String, dynamic>> _request(
    String path, {
    String method = 'GET',
    Map<String, dynamic>? body,
    String? token,
  }) async {
    final client = HttpClient()..connectionTimeout = const Duration(seconds: 8);
    try {
      final uri = Uri.parse('${baseUrl.replaceFirst(RegExp(r'/+$'), '')}$path');
      final request = await client.openUrl(method, uri).timeout(const Duration(seconds: 10));
      request.headers.set(HttpHeaders.acceptHeader, 'application/json');
      request.headers.set(HttpHeaders.contentTypeHeader, 'application/json');
      if (publishableKey.isNotEmpty && publishableKey != 'YOUR-PUBLISHABLE-KEY') {
        request.headers.set('apikey', publishableKey);
      }
      final authToken = token ?? sessionToken;
      if (authToken != null && authToken.isNotEmpty) request.headers.set(HttpHeaders.authorizationHeader, 'Bearer $authToken');
      if (body != null) request.write(jsonEncode(body));
      final response = await request.close().timeout(const Duration(seconds: 12));
      final raw = await response.transform(utf8.decoder).join();
      final data = raw.isEmpty ? <String, dynamic>{} : jsonDecode(raw) as Map<String, dynamic>;
      if (response.statusCode < 200 || response.statusCode >= 300) {
        final code = data['error']?.toString() ?? 'server_error';
        if (response.statusCode == 409) throw const SaffariApiException('این شماره موبایل یا کد ملی قبلاً ثبت شده است.');
        if (response.statusCode == 401) throw const SaffariApiException('اطلاعات ورود صحیح نیست.');
        if (response.statusCode == 400) throw const SaffariApiException('اطلاعات واردشده یا کد کلینیک معتبر نیست.');
        throw SaffariApiException('ارتباط با سرور برقرار نشد ($code).');
      }
      return data;
    } on SaffariApiException {
      rethrow;
    } on SocketException {
      throw const SaffariApiException('سرور مشترک در دسترس نیست. اتصال اینترنت یا راه‌اندازی سرور کلینیک را بررسی کنید.');
    } on HandshakeException {
      throw const SaffariApiException('اتصال امن به سرور برقرار نشد.');
    } on FormatException {
      throw const SaffariApiException('پاسخ سرور قابل خواندن نیست.');
    } finally {
      client.close(force: true);
    }
  }

  static Future<Map<String, dynamic>> registerPatient({
    required String firstName,
    required String lastName,
    required String mobile,
    required String nationalId,
    required String diseaseCode,
    required String clinicCode,
  }) => _request(
    '/patients/register',
    method: 'POST',
    body: {
      'firstName': firstName,
      'lastName': lastName,
      'mobile': mobile,
      'nationalId': nationalId,
      'diseaseCode': diseaseCode,
      'clinicCode': clinicCode,
    },
  );

  static Future<Map<String, dynamic>> loginPatient({
    required String mobile,
    required String nationalId,
  }) async {
    final result = await _request(
      '/patients/login',
      method: 'POST',
      body: {'mobile': mobile, 'nationalId': nationalId},
    );
    sessionToken = result['token']?.toString();
    return result;
  }

  static Future<Map<String, dynamic>> changePatientPassword({
    required String currentPassword,
    required String newPassword,
  }) async {
    final result = await _request(
      '/patients/change-password',
      method: 'POST',
      body: {'currentPassword': currentPassword, 'newPassword': newPassword},
    );
    sessionToken = result['token']?.toString();
    return result;
  }

  static Future<void> logout() async {
    try {
      if (sessionToken != null) {
        await _request('/logout', method: 'POST', body: const {}, token: sessionToken);
      }
    } finally {
      sessionToken = null;
    }
  }
}
