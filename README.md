# Welcome to your Lovable project

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Open your project in the [Lovable editor](https://lovable.dev) and keep building.

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: connect the project to GitHub and every change made in Lovable is committed straight to your repository.
- **Full ownership**: this code is yours. Push to your repository and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Built with

- TanStack Start
- TypeScript
- React
- Tailwind CSS

## Phone app

There are two ways to use this on a phone. Both use the same database as the website.

**Install the website as an app (Android and iPhone).** Open the published site in Chrome
(Android) or Safari (iPhone) and choose *Install app* / *Add to Home Screen*.

**Android app (APK).** Every push builds an APK with GitHub Actions
(`.github/workflows/android.yml`). Pushes to `main` publish it as the
[`android-latest` release](../../releases/tag/android-latest): open that page on the phone,
download `MDM-Manager.apk` and open it to install (Android asks once to allow installs from the
browser). New builds install over the old one, keeping you signed in.

- Set the repository variable `VITE_PUBLIC_SITE_URL` to the published website address so sign-up and password-reset e-mails sent from the app link back to it.
- Excel, PDF and CSV exports open the Android share sheet, so files can be saved to
  Files/Drive or sent on WhatsApp or e-mail.
- Builds are signed with `android/app/sideload.keystore` so updates install in place. For the
  Play Store, create your own key and pass it to the build through the `ANDROID_KEYSTORE_PATH`,
  `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` and `ANDROID_KEY_PASSWORD` variables.

To build it yourself you need Node.js, JDK 21 and Android Studio:

```sh
npm run android:sync   # builds the app's web files and copies them into android/
npm run android:open   # opens the project in Android Studio
```


## Hosting on Cloudflare

The website is also published on Cloudflare Pages at https://school-meal-hub.pages.dev.
`.github/workflows/cloudflare.yml` republishes it whenever `main` changes, once the
`CLOUDFLARE_API_TOKEN` (with "Cloudflare Pages: Edit" permission) and `CLOUDFLARE_ACCOUNT_ID`
repository secrets are added under Settings → Secrets and variables → Actions.

## Supabase gateway (for Indian networks)

Several Indian internet providers (Jio, Airtel, ACT) block `*.supabase.co`, where Lovable
Cloud keeps this app's database, so sign-in fails with "Failed to fetch". The Android app and
the Cloudflare website therefore talk to `https://school-meal-hub-api.pages.dev`, a small Cloudflare Pages
Function in `supabase-gateway/` that forwards those requests to the Supabase project. The
Lovable-hosted website still calls Supabase directly, so on those networks use the app or
https://school-meal-hub.pages.dev instead.
