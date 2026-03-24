/**
 * Remove o fundo branco de uma imagem via Canvas
 * Retorna PNG com fundo transparente (base64)
 */
export const removerFundoBranco = (
  imagemUrl: string,
  tolerancia: number = 30 // quanto de variação do branco aceitar
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onerror = reject

    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')!

      // Desenhar imagem original
      ctx.drawImage(img, 0, 0)

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const data = imageData.data

      // Tornar pixels brancos/quase brancos transparentes
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i]
        const g = data[i + 1]
        const b = data[i + 2]

        // Verificar se o pixel é branco ou quase branco
        const ehBranco =
          r >= (255 - tolerancia) &&
          g >= (255 - tolerancia) &&
          b >= (255 - tolerancia)

        if (ehBranco) {
          // Tornar transparente
          data[i + 3] = 0
        }
      }

      ctx.putImageData(imageData, 0, 0)

      // Retornar como PNG com transparência
      resolve(canvas.toDataURL('image/png'))
    }

    img.src = imagemUrl
  })
}

/**
 * Remove a moldura circular/quadrada/retangular do risco
 * Detecta linhas de borda e as remove mantendo só o conteúdo interno
 */
export const removerMoldura = (
  imagemUrl: string
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onerror = reject

    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')!

      ctx.drawImage(img, 0, 0)

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const data = imageData.data
      const w = canvas.width
      const h = canvas.height

      // Detectar e apagar pixels escuros que formam a moldura
      // A moldura fica nas bordas — verificar pixels nas regiões periféricas
      const margem = Math.floor(Math.min(w, h) * 0.05) // 5% de margem

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const idx = (y * w + x) * 4
          const r = data[idx]
          const g = data[idx + 1]
          const b = data[idx + 2]

          // Pixel escuro (parte do desenho)
          const ehEscuro = r < 100 && g < 100 && b < 100

          if (ehEscuro) {
            // Verificar se está na região de borda (onde fica a moldura)
            const nasBordas =
              x < margem * 3 || x > w - margem * 3 ||
              y < margem * 3 || y > h - margem * 3

            // Verificar se está em arco (moldura circular)
            const centroX = w / 2
            const centroY = h / 2
            const distCentro = Math.sqrt(
              Math.pow(x - centroX, 2) + Math.pow(y - centroY, 2)
            )
            const raio = Math.min(w, h) * 0.47 // raio aproximado da moldura
            const nasMoldura = Math.abs(distCentro - raio) < margem * 2

            if (nasBordas && nasMoldura) {
              // Apagar pixel da moldura — tornar branco/transparente
              data[idx] = 255
              data[idx + 1] = 255
              data[idx + 2] = 255
              data[idx + 3] = 0 // transparente
            }
          }
        }
      }

      ctx.putImageData(imageData, 0, 0)
      resolve(canvas.toDataURL('image/png'))
    }

    img.src = imagemUrl
  })
}
