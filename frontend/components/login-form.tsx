"use client"

import { cn } from "@/lib/utils"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { loginSchema, LoginFormValues } from "@/lib/schemas/login-schema"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { authClient } from "@/lib/auth-client"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {

  const searchParams = useSearchParams()
  const redirectTarget = searchParams.get("from") || "/"
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  })

  function safeRedirect(target?: string | null) {
    return target && target.startsWith("/") && !target.startsWith("//") ? target : "/"
  }

  async function onSubmit(values: LoginFormValues) {
    try {
      const { error } = await authClient.signIn.email({
        email: values.email,
        password: values.password,
      })
      if (error) {
        setError("root", { message: error.message || "Invalid email or password" })
        return
      }
      window.location.href = safeRedirect(redirectTarget)
    } catch {
      setError("root", { message: "Network error. Please try again." })
    }
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle>Login to your account</CardTitle>
          <CardDescription>
            Enter your email below to login to your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  placeholder="m@example.com"
                  required
                  {...register("email")}
                />
                {errors.email && (
                  <p className="text-sm text-destructive">{errors.email.message}</p>
                )}
              </Field>
              <Field>
                <div className="flex items-center">
                  <FieldLabel htmlFor="password">Password</FieldLabel>
                  <a
                    href="#"
                    className="ml-auto inline-block text-sm underline-offset-4 hover:underline"
                  >
                    Forgot your password?
                  </a>
                </div>
                <Input id="password" type="password" required {...register("password")} />
                {errors.password && (
                  <p className="text-sm text-destructive">{errors.password.message}</p>
                )}
              </Field>
              <Field>
                <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Logging in..." : "Login"}</Button>
                {errors.root && (
                  <p className="text-sm text-destructive text-center">
                    {errors.root.message}
                  </p>
                )}
                <FieldDescription className="text-center">
                  Don&apos;t have an account? <Link href={"/signup"}>Sign Up</Link>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
