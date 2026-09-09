export function ErrorFallback() {
  return (
    <main className="min-h-screen bg-background text-foreground flex items-center justify-center px-6">
      <section role="alert" className="max-w-md text-center space-y-4">
        <h1 className="text-xl font-semibold">Algo deu errado</h1>
        <p className="text-sm text-muted-foreground">Ocorreu um erro inesperado. Tente recarregar a página.</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Recarregar página
        </button>
      </section>
    </main>
  );
}
