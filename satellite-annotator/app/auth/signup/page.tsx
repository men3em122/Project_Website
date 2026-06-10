import { SignUpForm } from '@/components/auth/SignUpForm';

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-20">
      <div className="w-full max-w-md">
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full border border-[rgba(188,140,255,0.05)] pointer-events-none" />
        <div className="glass-card rounded-3xl p-8 border border-[#21262d] relative z-10">
          <SignUpForm />
        </div>
      </div>
    </div>
  );
}
