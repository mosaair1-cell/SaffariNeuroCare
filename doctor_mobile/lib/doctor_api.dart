import 'dart:convert';
import 'dart:io';

class DoctorApiException implements Exception {
  final String message;
  const DoctorApiException(this.message);
}

class DoctorApi {
  static const String baseUrl = String.fromEnvironment(
    'SAFFARI_API_BASE_URL',
    defaultValue: 'https://api.mhsaffari.ir/v1',
  );
  static String? token;

  static Future<Map<String, dynamic>> _request(
    String path, {
    String method = 'GET',
    Map<String, dynamic>? body,
    bool authenticated = false,
  }) async {
    final client = HttpClient()..connectionTimeout = const Duration(seconds: 8);
    try {
      final uri = Uri.parse('${baseUrl.replaceFirst(RegExp(r'/+$'), '')}$path');
      final request = await client.openUrl(method, uri).timeout(const Duration(seconds: 10));
      request.headers.set(HttpHeaders.acceptHeader, 'application/json');
      request.headers.set(HttpHeaders.contentTypeHeader, 'application/json');
      if (authenticated && token != null) {
        request.headers.set(HttpHeaders.authorizationHeader, 'Bearer $token');
      }
      if (body != null) request.write(jsonEncode(body));
      final response = await request.close().timeout(const Duration(seconds: 12));
      final raw = await response.transform(utf8.decoder).join();
      final data = raw.isEmpty ? <String, dynamic>{} : jsonDecode(raw) as Map<String, dynamic>;
      if (response.statusCode < 200 || response.statusCode >= 300) {
        if (response.statusCode == 401) throw const DoctorApiException('ورود پزشک معتبر نیست یا نشست پایان یافته است.');
        throw DoctorApiException('سرور مشترک پاسخ مناسب نداد: ${data['error'] ?? response.statusCode}');
      }
      return data;
    } on DoctorApiException {
      rethrow;
    } on SocketException {
      throw const DoctorApiException('سرور مشترک کلینیک در دسترس نیست. ابتدا API را روی HTTPS مستقر کنید.');
    } on HandshakeException {
      throw const DoctorApiException('اتصال امن به سرور برقرار نشد.');
    } finally {
      client.close(force: true);
    }
  }

  static Future<void> login({required String clinicCode, required String password}) async {
    final result = await _request('/doctor/login', method: 'POST', body: {
      'clinicCode': clinicCode,
      'password': password,
    });
    token = result['token']?.toString();
    if (token == null || token!.isEmpty) {
      throw const DoctorApiException('سرور توکن ورود برنگرداند.');
    }
  }

  static Future<List<Map<String, dynamic>>> fetchPatients() async {
    final result = await _request('/doctor/patients', authenticated: true);
    return (result['patients'] as List? ?? const [])
        .whereType<Map<String, dynamic>>()
        .toList();
  }

  static Future<void> logout() async {
    token = null;
  }
}
