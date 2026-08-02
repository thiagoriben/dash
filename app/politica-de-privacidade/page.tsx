import * as React from "react"
import Link from "next/link"

export const metadata = {
  title: "Política de Privacidade | Dash Tráfego",
  description: "Política de Privacidade e Proteção de Dados do SaaS Dash Tráfego.",
}

export default function PoliticaPrivacidadePage() {
  return (
    <div className="min-h-screen bg-background text-foreground py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto bg-card p-8 rounded-xl border border-border shadow-sm space-y-6">
        <div className="border-b border-border pb-6">
          <h1 className="text-3xl font-display font-bold">Política de Privacidade</h1>
          <p className="text-sm text-muted mt-2">Última atualização: 02 de Agosto de 2026</p>
        </div>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-primary">1. Introdução</h2>
          <p className="text-sm text-muted leading-relaxed">
            O <strong>Dash Tráfego</strong> (&quot;nós&quot;, &quot;nosso&quot; ou &quot;plataforma&quot;) respeita a sua privacidade e está comprometido em proteger os dados pessoais de seus usuários. Esta Política de Privacidade descreve como coletamos, usamos, armazenamos e protegemos suas informações ao utilizar nossos serviços e ao conectar sua conta com a API da <strong>Meta (Facebook Ads)</strong>.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-primary">2. Dados Coletados na Integração com a Meta (Facebook Ads)</h2>
          <p className="text-sm text-muted leading-relaxed">
            Ao conectar sua conta do Facebook Ads ao Dash Tráfego via OAuth 2.0, solicitamos estritamente permissões de <strong>leitura (read-only)</strong>:
          </p>
          <ul className="list-disc list-inside text-sm text-muted space-y-1 pl-4">
            <li><strong>Identificação da Conta de Anúncios</strong>: ID da conta de anúncios selecionada.</li>
            <li><strong>Métricas de Anúncios</strong>: Valor investido (spend), impressões, cliques, CPC, CPM e CTR.</li>
            <li><strong>Identificador de Usuário e Nome da BM</strong>: Apenas para exibição e vinculação ao seu projeto na plataforma.</li>
          </ul>
          <p className="text-sm text-muted leading-relaxed mt-2 font-medium text-foreground">
            ⚠️ NUNCA solicitamos permissões de alteração, publicação ou criação de anúncios, garantindo 100% de segurança contra alterações indesejadas em suas contas.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-primary">3. Uso das Informações</h2>
          <p className="text-sm text-muted leading-relaxed">
            As informações coletadas são utilizadas exclusivamente para:
          </p>
          <ul className="list-disc list-inside text-sm text-muted space-y-1 pl-4">
            <li>Exibir relatórios consolidados de tráfego pago e métricas financeiras nos dashboards do usuário.</li>
            <li>Calcular o retorno sobre investimento (ROAS, CPA e Lucro Líquido) de seus projetos.</li>
            <li>Agilizar o preenchimento de métricas diárias sem necessidade de digitação manual.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-primary">4. Compartilhamento e Segurança dos Dados</h2>
          <p className="text-sm text-muted leading-relaxed">
            Não vendemos, alugamos ou compartilhamos seus dados ou métricas do Facebook Ads com terceiros. Todos os tokens de acesso são armazenados com criptografia no banco de dados com políticas estritas de segurança (RLS - Row Level Security), garantindo que apenas você e os membros autorizados do seu projeto tenham acesso.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-primary">5. Exclusão de Dados e Desconexão</h2>
          <p className="text-sm text-muted leading-relaxed">
            Você pode desconectar sua conta do Facebook Ads a qualquer momento através do painel do seu projeto. Ao desconectar, os tokens de acesso associados são permanentemente removidos de nossos servidores. Para solicitar a exclusão total dos dados da sua conta, entre em contato pelo suporte ou envie um e-mail para <strong>suporte@bandodash.com</strong>.
          </p>
        </section>

        <section className="space-y-3 border-t border-border pt-6">
          <h2 className="text-xl font-semibold text-primary">6. Contato</h2>
          <p className="text-sm text-muted">
            Se você tiver dúvidas sobre esta Política de Privacidade ou sobre o tratamento de seus dados, entre em contato conosco pelo e-mail <strong>suporte@bandodash.com</strong>.
          </p>
        </section>

        <div className="border-t border-border pt-6 flex justify-between items-center">
          <Link href="/" className="text-sm font-medium text-primary hover:underline">
            ← Voltar para o Dash Tráfego
          </Link>
          <p className="text-xs text-muted">© 2026 Dash Tráfego. Todos os direitos reservados.</p>
        </div>
      </div>
    </div>
  )
}
