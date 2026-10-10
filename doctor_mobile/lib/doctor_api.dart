import 'dart:convert';
import 'dart:io';

class DoctorApi {
  static const String baseUrl = String.fromEnvironment('SAFFARI_API_BASE_URL', defaultValue: 'https://api.mhsaffari.ir/v1');
  static String? token;
}
