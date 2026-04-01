import jsPDF from 'jspdf'
import { removerFundoBranco, removerMoldura } from './removerFundo'

// Tamanho A4 em cm
const A4_LARGURA_CM = 21
const A4_ALTURA_CM = 29.7

export interface OpcoesPDFRisco {
  tamanho: number
  removerMoldura: boolean
  nomeArquivo?: string
}

export const gerarPDFRisco = async (
  imagemUrl: string,
  opcoes: OpcoesPDFRisco
): Promise<void> => {
  const { tamanho, removerMoldura: devRemoverMoldura, nomeArquivo = 'risco' } = opcoes

  // 1. Processar imagem — remover moldura se solicitado
  let imagemProcessada = imagemUrl

  if (devRemoverMoldura) {
    imagemProcessada = await removerMoldura(imagemUrl)
  }

  // 2. Remover fundo branco — deixar transparente
  const imagemTransparente = await removerFundoBranco(imagemProcessada)

  // 3. Criar PDF A4
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onerror = reject

    img.onload = () => {
      try {
        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'cm',
          format: 'a4' // sempre A4
        })

        // Fundo branco ÚNICO do PDF
        pdf.setFillColor(255, 255, 255)
        pdf.rect(0, 0, A4_LARGURA_CM, A4_ALTURA_CM, 'F')

        // Calcular posição centralizada no A4
        const x = (A4_LARGURA_CM - tamanho) / 2
        const y = (A4_ALTURA_CM - tamanho) / 2

        // Adicionar risco com PNG transparente
        // O PNG transparente sobre o fundo branco do PDF = sem "quadrado duplo"
        pdf.addImage(
          imagemTransparente,
          'PNG',
          x,      // centralizado horizontalmente
          y,      // centralizado verticalmente
          tamanho, // largura exata em cm
          tamanho  // altura exata em cm
        )

        // Linhas guia de corte discretas (cinza claro)
        pdf.setDrawColor(220, 220, 220)
        pdf.setLineWidth(0.02)
        pdf.setLineDashPattern([0.1, 0.2], 0)
        pdf.rect(x, y, tamanho, tamanho)
        pdf.setLineDashPattern([], 0) // resetar

        // Rodapé com instrução
        pdf.setFontSize(7)
        pdf.setTextColor(180, 180, 180)
        pdf.text(
          `Meu Atelie  ·  ${tamanho}cm x ${tamanho}cm  ·  IMPRIMIR EM TAMANHO REAL (100%) - nao ajustar a pagina`,
          A4_LARGURA_CM / 2,
          A4_ALTURA_CM - 0.8,
          { align: 'center' }
        )

        // Nome do arquivo
        const nome = `${nomeArquivo}-${tamanho}cm-A4-meuatelie.pdf`
        pdf.save(nome)
        resolve()

      } catch (err) {
        reject(err)
      }
    }

    img.src = imagemTransparente
  })
}
