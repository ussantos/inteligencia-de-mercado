// Este arquivo centraliza chamadas HTTP com limite de tempo.
// Assim, quando uma API externa fica lenta ou fora do ar, a aplicacao para de esperar e consegue usar fallback.
type TimeoutRequestInit = RequestInit & {
  // O Next.js permite controlar cache/revalidacao com a chave "next".
  // Como este helper tambem recebe chamadas do Next, aceitamos essa opcao explicitamente.
  next?: { revalidate?: number | false; tags?: string[] };
};

export async function fetchWithTimeout(input: RequestInfo | URL, init: TimeoutRequestInit = {}, timeoutMs = 15000): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`API externa nao respondeu em ate ${Math.round(timeoutMs / 1000)} segundos.`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
