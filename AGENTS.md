# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Environment

All Flutter/Dart/Gradle commands **must** run inside the Nix dev shell — these tools are not in PATH directly:

```bash
nix develop -c flutter <command>
nix develop -c dart <command>
```

The `shellHook` writes `android/local.properties` (gitignored) with SDK/NDK paths and patches `~/.gradle/gradle.properties` with `android.aapt2FromMavenOverride` to fix NixOS's incompatible generic `aapt2` binary.

## Common Commands

```bash
# Run on connected device
nix develop -c flutter run

# Build APK
nix develop -c flutter build apk

# Build release APK
nix develop -c flutter build apk --release

# Analyze (lint)
nix develop -c flutter analyze

# Unit tests
nix develop -c flutter test

# Single test file
nix develop -c flutter test test/domain/filter_rule_test.dart

# Integration tests (requires connected device)
nix develop -c flutter test integration_test/app_test.dart

# Regenerate Hive/Riverpod/Drift generated files
nix develop -c dart run build_runner build --delete-conflicting-outputs

# Watch for changes and regenerate
nix develop -c dart run build_runner watch --delete-conflicting-outputs
```

## Architecture

### Layer rules (strictly enforced)

- `ui/` → `providers/` only — never imports `services/` or `data/` directly
- `domain/` — pure Dart, no Flutter/Hive/drift/SDK imports
- `services/` — wraps platform channels; no widget knows `MethodChannel` directly
- `data/` — repositories using Hive (state) or drift (log)

### State management

Riverpod with code generation (`riverpod_annotation`). Providers declared in `lib/providers/app_providers.dart` — infrastructure providers throw `UnimplementedError()` and are overridden in `bootstrap()` via `ProviderScope`. The `HomeNotifier` is overridden with `_InitialHomeNotifier` to inject the pre-loaded Hive state at startup.

After adding/modifying providers or Hive models, run `build_runner` to regenerate `.g.dart` files.

### Persistence

- **Hive** — `HomeState`, `ButtonConfig`, `ThemeConfig`, folders, aliases, preferences. All Hive adapters registered in `lib/core/bootstrap.dart`. Schema versioned from day one. Mutations must persist immediately.
- **drift (SQLite)** — Secure log (`lib/data/log_database.dart`). Sensitive fields encrypted via Android Keystore through `flutter_secure_storage`.

### Navigation (go_router)

Routes defined in `lib/core/router.dart`. Protected routes (`/log`, `/hidden`, auth settings) should check `authSession` via redirect guards.

### Platform channels (Kotlin ↔ Flutter)

All channels are encapsulated in `lib/services/`:

| Service | Channel type | Purpose |
|---|---|---|
| `SystemService` | MethodChannel | Lock screen, notification panel via AccessibilityService |
| `OverlayServiceBridge` | MethodChannel | Control floating overlay button |
| `NotificationBridge` | EventChannel | Receive notifications from `NotificationListenerService` |
| `LauncherAppsService` | MethodChannel + EventChannel | List apps; package install/remove events |
| `IconService` | MethodChannel | Fetch adaptive icons as PNG bytes (cached to disk) |
| `MusicService` | EventChannel | Media session metadata from `LauncherNotificationService` |

Platform channels are stateless — state lives in Dart, not in Kotlin.

### Notifications pipeline

`NotificationBridge` (EventChannel) → `NotificationProcessor` applies `FilterRule` logic (Dart, not Kotlin) → routes to hidden inbox (`hide`), secure log (`silent_log`), or passes through (`show`) → updates `OverlayServiceBridge` badge/color.

### Themes

All colors come from `LauncherTheme` (`lib/domain/launcher_theme.dart`). Hardcoded `Colors.black` or `Color(0xFF...)` in widgets is a bug. Active variants: `MinimalDark`, `MinimalLight`, `DynamicWallpaper`. `DynamicWallpaper` derives tokens from `palette_generator` running on wallpaper bytes.

### Code generation

Three generators are used — all produce `.g.dart` files, never edit those manually:
- `hive_generator` — Hive adapters for domain models (`@HiveType`, `@HiveField`)
- `riverpod_generator` — Provider classes (`@riverpod`, `@Riverpod`)
- `drift_dev` — Database DAOs and queries (`lib/data/log_database.dart`)

## Key constraints

- **NDK version pinned at `28.2.13676358`** in both `flake.nix` and `android/app/build.gradle.kts` — keep in sync when updating.
- **Gradle wrapper pinned at `gradle-8.14.4`** — do not let Gradle auto-update.
- **List layout only** — never grid.
- **`LauncherApps` API** (not `PackageManager`) for all app enumeration.
- **AccessibilityService** (not `DevicePolicyManager`) for lock screen and notification panel.
- Heavy work in `Isolate`: fuzzy search index, palette extraction, bulk notification classification.
- `FLAG_SECURE` on all protected screens (hidden inbox, secure log, auth settings).
- Sensitive data (PIN, passwords, crypto keys) only in `flutter_secure_storage` / Android Keystore — never Hive or SharedPreferences.
- No sensitive content in logcat in release builds.
