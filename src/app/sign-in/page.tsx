import { redirect } from "next/navigation";
import { AuthError } from "next-auth";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signIn } from "@/lib/auth";

const signInAction = async (formData: FormData) => {
  "use server";

  const email = formData.get("email");
  const password = formData.get("password");
  const redirectToRaw = formData.get("redirectTo");
  const redirectTo =
    typeof redirectToRaw === "string" && redirectToRaw.length > 0
      ? redirectToRaw
      : "/";

  if (typeof email !== "string" || typeof password !== "string") {
    redirect("/sign-in?error=InvalidCredentials");
  }

  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo,
    });
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      const authError = err as AuthError;
      const reason =
        authError.type === "CredentialsSignin" ? "InvalidCredentials" : "Auth";
      redirect(`/sign-in?error=${reason}`);
    }
    throw err;
  }
};

const googleSignInAction = async (formData: FormData) => {
  "use server";

  const redirectToRaw = formData.get("redirectTo");
  const redirectTo =
    typeof redirectToRaw === "string" && redirectToRaw.length > 0
      ? redirectToRaw
      : "/";

  await signIn("google", { redirectTo });
};

function errorMessage(code?: string | string[]) {
  if (!code) return null;
  const value = Array.isArray(code) ? code[0] : code;
  switch (value) {
    case "InvalidCredentials":
      return "Incorrect email or password.";
    case "Auth":
      return "Unable to sign in at the moment. Please try again.";
    default:
      return null;
  }
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedParams = searchParams ? await searchParams : undefined;
  const redirectTarget =
    typeof resolvedParams?.redirectTo === "string" &&
    resolvedParams.redirectTo.length > 0
      ? resolvedParams.redirectTo
      : undefined;

  const googleClientId =
    process.env.GOOGLE_CLIENT_ID ?? process.env.AUTH_GOOGLE_ID ?? "";
  const googleClientSecret =
    process.env.GOOGLE_CLIENT_SECRET ?? process.env.AUTH_GOOGLE_SECRET ?? "";

  const hasGoogleProvider = Boolean(googleClientId && googleClientSecret);

  const message = errorMessage(resolvedParams?.error);

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Sign In</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {hasGoogleProvider ? (
            <>
              <form action={googleSignInAction}>
                <input
                  type="hidden"
                  name="redirectTo"
                  value={redirectTarget ?? ""}
                />
                <Button type="submit" variant="outline" className="w-full">
                  Continue with Google
                </Button>
              </form>
              <div className="text-center text-xs uppercase tracking-wide text-muted-foreground">
                Or sign in with email
              </div>
            </>
          ) : null}
          <form action={signInAction} className="space-y-4">
            <input
              type="hidden"
              name="redirectTo"
              value={redirectTarget ?? ""}
            />
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </div>
            {message ? (
              <p className="text-sm text-destructive" role="alert">
                {message}
              </p>
            ) : null}
            <Button type="submit" className="w-full">
              Sign in
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
