import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 px-4 text-center">
      <h1 className="text-4xl">Page not found</h1>
      <Link href="/dashboard" className="underline underline-offset-2">
        Back to the dashboard
      </Link>
    </div>
  );
}
