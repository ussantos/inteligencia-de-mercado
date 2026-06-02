import { redirect } from 'next/navigation';

export default function SignInPage() {
  // O projeto agora e publico e sem login.
  // Se algum link antigo apontar para /sign-in, mandamos a pessoa para a ferramenta.
  redirect('/');
}
