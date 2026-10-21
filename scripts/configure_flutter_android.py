#!/usr/bin/env python3
"""Configure generated Flutter Android project metadata and optional Play upload signing.

Run from a Flutter project root after `flutter create . --platforms=android`.
The upload keystore and key.properties are supplied by GitHub Actions secrets and
are deliberately never committed to the repository.
"""
from __future__ import annotations

import argparse
import re
from pathlib import Path


def replace_once(pattern: str, replacement: str, text: str, label: str) -> str:
    updated, count = re.subn(pattern, replacement, text, count=1, flags=re.MULTILINE)
    if count != 1:
        raise RuntimeError(f"Could not configure Android {label}; Flutter template changed.")
    return updated


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--label", required=True)
    parser.add_argument("--application-id", required=True)
    args = parser.parse_args()

    manifest = Path("android/app/src/main/AndroidManifest.xml")
    if not manifest.exists():
        raise FileNotFoundError(f"Android manifest not found: {manifest}")
    xml = manifest.read_text(encoding="utf-8")
    if "android.permission.INTERNET" not in xml:
        xml, count = re.subn(
            r"(<manifest\b[^>]*>)",
            r'\1\n    <uses-permission android:name="android.permission.INTERNET"/>',
            xml,
            count=1,
        )
        if count != 1:
            raise RuntimeError("Could not add Android INTERNET permission.")
    xml = replace_once(r'android:label="[^"]+"',
                       f'android:label="{args.label}"', xml, "app label")
    manifest.write_text(xml, encoding="utf-8")

    app_dir = Path("android/app")
    kts = app_dir / "build.gradle.kts"
    groovy = app_dir / "build.gradle"
    if kts.exists():
        gradle = kts
        text = gradle.read_text(encoding="utf-8")
        text = replace_once(r'namespace\s*=\s*"[^"]+"',
                            f'namespace = "{args.application_id}"', text, "namespace")
        text = replace_once(r'applicationId\s*=\s*"[^"]+"',
                            f'applicationId = "{args.application_id}"', text, "application id")
        text = replace_once(r'compileSdk\s*=\s*(?:flutter\.compileSdkVersion|\d+)',
                            "compileSdk = 36", text, "compile SDK")
        text = replace_once(r'targetSdk\s*=\s*(?:flutter\.targetSdkVersion|\d+)',
                            "targetSdk = 36", text, "target SDK")

        signing_imports = """import java.io.FileInputStream
import java.util.Properties

"""
        signing_vars = """val keystoreProperties = Properties()
val keystorePropertiesFile = rootProject.file("key.properties")
if (keystorePropertiesFile.exists()) {
    FileInputStream(keystorePropertiesFile).use { keystoreProperties.load(it) }
}

"""
        if "val keystorePropertiesFile" not in text:
            text = text.replace("plugins {", signing_imports + "plugins {", 1)
            text, count = re.subn(
                r'(plugins\s*\{.*?\})\s*(\nandroid\s*\{)',
                lambda match: match.group(1) + "\n\n" + signing_vars.rstrip() + "\n" + match.group(2),
                text,
                count=1,
                flags=re.DOTALL,
            )
            if count != 1:
                raise RuntimeError("Could not place Android keystore configuration after the Gradle plugins block.")
        if 'create("release")' not in text:
            block = '''    signingConfigs {
        create("release") {
            if (keystorePropertiesFile.exists()) {
                keyAlias = keystoreProperties["keyAlias"] as String
                keyPassword = keystoreProperties["keyPassword"] as String
                storeFile = rootProject.file(keystoreProperties["storeFile"] as String)
                storePassword = keystoreProperties["storePassword"] as String
            }
        }
    }

'''
            if "    buildTypes {" not in text:
                raise RuntimeError("Could not locate Android buildTypes block for release signing.")
            text = text.replace("    buildTypes {", block + "    buildTypes {", 1)
        text, count = re.subn(
            r'signingConfig\s*=\s*signingConfigs\.getByName\("debug"\)',
            'signingConfig = if (keystorePropertiesFile.exists()) signingConfigs.getByName("release") else signingConfigs.getByName("debug")',
            text,
            count=1,
        )
        if count != 1:
            raise RuntimeError("Could not configure Android release signing.")
        gradle.write_text(text, encoding="utf-8")
    elif groovy.exists():
        gradle = groovy
        text = gradle.read_text(encoding="utf-8")
        text = replace_once(r'namespace\s+["\'][^"\']+["\']',
                            f'namespace "{args.application_id}"', text, "namespace")
        text = replace_once(r'applicationId\s+["\'][^"\']+["\']',
                            f'applicationId "{args.application_id}"', text, "application id")
        text = replace_once(r'compileSdk\s+(?:flutter\.compileSdkVersion|\d+)',
                            "compileSdk 36", text, "compile SDK")
        text = replace_once(r'targetSdk\s+(?:flutter\.targetSdkVersion|\d+)',
                            "targetSdk 36", text, "target SDK")
        signing_setup = '''def keystoreProperties = new Properties()
def keystorePropertiesFile = rootProject.file('key.properties')
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}

'''
        if "keystorePropertiesFile" not in text:
            text = signing_setup + text
        if "signingConfigs {" not in text:
            block = '''    signingConfigs {
        release {
            if (keystorePropertiesFile.exists()) {
                keyAlias keystoreProperties['keyAlias']
                keyPassword keystoreProperties['keyPassword']
                storeFile rootProject.file(keystoreProperties['storeFile'])
                storePassword keystoreProperties['storePassword']
            }
        }
    }

'''
            if "    buildTypes {" not in text:
                raise RuntimeError("Could not locate Android buildTypes block for release signing.")
            text = text.replace("    buildTypes {", block + "    buildTypes {", 1)
        text, count = re.subn(
            r'signingConfig\s+signingConfigs\.debug',
            'signingConfig keystorePropertiesFile.exists() ? signingConfigs.release : signingConfigs.debug',
            text,
            count=1,
        )
        if count != 1:
            raise RuntimeError("Could not configure Android release signing.")
        gradle.write_text(text, encoding="utf-8")
    else:
        raise FileNotFoundError("No supported Android Gradle file exists under android/app.")

    print(f"Configured label={args.label!r}, applicationId={args.application_id}, targetSdk=36.")


if __name__ == "__main__":
    main()
