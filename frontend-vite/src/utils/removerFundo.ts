/**
 * Remove o fundo branco de uma imagem via Canvas
 * Retorna PNG com fundo transparente (base64)
 */
export const removerFundoBranco = (
  imagemUrl: string,
  tolerancia: number = 15 // tolerância menor — só remove branco puro e quase puro
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

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i]
        const g = data[i + 1]
        const b = data[i + 2]

        // Só remove branco puro e quase puro
        // Cinzas do anti-aliasing (abaixo de 240) são mantidos
        if (r >= 240 && g >= 240 && b >= 240) {
          data[i + 3] = 0 // transparente
        }
      }

      ctx.putImageData(imageData, 0, 0)
      resolve(canvas.toDataURL('image/png'))
    }

    img.src = imagemUrl
  })
}

/**
 * Remove a moldura aplicando clip na área interna.
 * Utiliza Flood-Fill para detectar dinamicamente as dimensões e o centro 
 * reais do bastidor desenhado pela IA, independente da margem da imagem.
 */
export const removerMoldura = (
  imagemUrl: string,
  formato: 'redondo' | 'quadrado' | 'retangular' | 'sem_bastidor' = 'redondo'
): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (formato === 'sem_bastidor') {
      resolve(imagemUrl)
      return
    }

    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onerror = reject

    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')!

      const w = canvas.width
      const h = canvas.height

      // Desenha imagem temporariamente para análise de pixels
      ctx.drawImage(img, 0, 0)
      const imageData = ctx.getImageData(0, 0, w, h)
      const data = imageData.data

      const isBranco = (idx: number) => {
        const p = idx * 4
        return data[p] >= 200 && data[p + 1] >= 200 && data[p + 2] >= 200
      }

      const mask = new Uint8Array(w * h)
      const queue = new Int32Array(w * h)
      let head = 0
      let tail = 0

      // Seed das bordas para o Flood Fill (identifica o fundo branco externo)
      const seed = (idx: number) => {
        if (mask[idx] === 0) {
          if (isBranco(idx)) {
            mask[idx] = 1
            queue[tail++] = idx
          } else {
            mask[idx] = 2 // Atingiu um contorno preto
          }
        }
      }

      for (let x = 0; x < w; x++) { seed(x); seed((h - 1) * w + x); }
      for (let y = 0; y < h; y++) { seed(y * w); seed(y * w + (w - 1)); }

      while (head < tail) {
        const curr = queue[head++]
        const cx = curr % w
        const cy = Math.floor(curr / w)

        if (cx > 0) seed(curr - 1)
        if (cx < w - 1) seed(curr + 1)
        if (cy > 0) seed(curr - w)
        if (cy < h - 1) seed(curr + w)
      }

      // Encontra a Bounding Box real do contorno preto
      let minX = w, maxX = 0, minY = h, maxY = 0
      let achouContorno = false

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          if (mask[y * w + x] === 2) {
            if (x < minX) minX = x
            if (x > maxX) maxX = x
            if (y < minY) minY = y
            if (y > maxY) maxY = y
            achouContorno = true
          }
        }
      }

      // Se a imagem não for padrão, usa tamanho total
      if (!achouContorno) { minX = 0; maxX = w; minY = 0; maxY = h; }

      const frameCx = (minX + maxX) / 2
      const frameCy = (minY + maxY) / 2
      const frameRw = Math.max(1, (maxX - minX) / 2)
      const frameRh = Math.max(1, (maxY - minY) / 2)

      // 8% de recuo isola a linha espessa gerada pela IA
      const recuoX = frameRw * 0.08
      const recuoY = frameRh * 0.08

      ctx.clearRect(0, 0, w, h)
      ctx.save()
      ctx.beginPath()

      if (formato === 'redondo') {
        const raio = Math.max(1, Math.min(frameRw, frameRh) - Math.min(recuoX, recuoY))
        ctx.arc(frameCx, frameCy, raio, 0, Math.PI * 2)

      } else if (formato === 'quadrado') {
        const tamanho = Math.max(1, (Math.min(frameRw, frameRh) * 2) - Math.min(recuoX, recuoY) * 2)
        const x = frameCx - tamanho / 2
        const y = frameCy - tamanho / 2
        const r = tamanho * 0.04
        ctx.moveTo(x + r, y)
        ctx.lineTo(x + tamanho - r, y)
        ctx.quadraticCurveTo(x + tamanho, y, x + tamanho, y + r)
        ctx.lineTo(x + tamanho, y + tamanho - r)
        ctx.quadraticCurveTo(x + tamanho, y + tamanho, x + tamanho - r, y + tamanho)
        ctx.lineTo(x + r, y + tamanho)
        ctx.quadraticCurveTo(x, y + tamanho, x, y + tamanho - r)
        ctx.lineTo(x, y + r)
        ctx.quadraticCurveTo(x, y, x + r, y)

      } else if (formato === 'retangular') {
        const rw = Math.max(1, (frameRw * 2) - recuoX * 2)
        const rh = Math.max(1, (frameRh * 2) - recuoY * 2)
        const x = frameCx - rw / 2
        const y = frameCy - rh / 2
        const r = Math.min(rw, rh) * 0.03
        ctx.moveTo(x + r, y)
        ctx.lineTo(x + rw - r, y)
        ctx.quadraticCurveTo(x + rw, y, x + rw, y + r)
        ctx.lineTo(x + rw, y + rh - r)
        ctx.quadraticCurveTo(x + rw, y + rh, x + rw - r, y + rh)
        ctx.lineTo(x + r, y + rh)
        ctx.quadraticCurveTo(x, y + rh, x, y + rh - r)
        ctx.lineTo(x, y + r)
        ctx.quadraticCurveTo(x, y, x + r, y)

      } else {
        ctx.rect(0, 0, w, h)
      }

      ctx.closePath()
      ctx.clip()

      ctx.drawImage(img, 0, 0)
      ctx.restore()

      resolve(canvas.toDataURL('image/png'))
    }

    img.src = imagemUrl
  })
}

/**
 * Recorta a imagem limitando-se exatamente aos conteúdos escuros.
 * Elimina toda a margem "branca" exterior criada pela IA.
 * Isso garante que o tamanho da arte seja 100% fidedigno ao enviado para o PDF.
 */
export const cortarAoBastidor = (
  imagemUrl: string,
  margemSeguranca: number = 0.02 // 2% de respiro
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onerror = reject

    img.onload = () => {
      const origCanvas = document.createElement('canvas')
      origCanvas.width = img.width
      origCanvas.height = img.height
      const ctx = origCanvas.getContext('2d')!

      const w = origCanvas.width
      const h = origCanvas.height
      ctx.drawImage(img, 0, 0)
      
      const imageData = ctx.getImageData(0, 0, w, h)
      const data = imageData.data

      const mask = new Uint8Array(w * h)
      const queue = new Int32Array(w * h)
      let head = 0
      let tail = 0

      const isBranco = (idx: number) => {
        const p = idx * 4
        return data[p] >= 200 && data[p + 1] >= 200 && data[p + 2] >= 200
      }

      const seed = (idx: number) => {
        if (mask[idx] === 0) {
          if (isBranco(idx)) {
            mask[idx] = 1
            queue[tail++] = idx
          } else {
            mask[idx] = 2
          }
        }
      }

      for (let x = 0; x < w; x++) { seed(x); seed((h - 1) * w + x); }
      for (let y = 0; y < h; y++) { seed(y * w); seed(y * w + (w - 1)); }

      while (head < tail) {
        const curr = queue[head++]
        const cx = curr % w
        const cy = Math.floor(curr / w)

        if (cx > 0) seed(curr - 1)
        if (cx < w - 1) seed(curr + 1)
        if (cy > 0) seed(curr - w)
        if (cy < h - 1) seed(curr + w)
      }

      let minX = w, maxX = 0, minY = h, maxY = 0
      let achouContorno = false

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          if (mask[y * w + x] === 2) {
            if (x < minX) minX = x
            if (x > maxX) maxX = x
            if (y < minY) minY = y
            if (y > maxY) maxY = y
            achouContorno = true
          }
        }
      }

      if (!achouContorno) {
        minX = 0; maxX = w; minY = 0; maxY = h;
      }

      const realW = maxX - minX
      const realH = maxY - minY
      const padX = realW * margemSeguranca
      const padY = realH * margemSeguranca

      const cropX = Math.max(0, minX - padX)
      const cropY = Math.max(0, minY - padY)
      const cropW = Math.min(w - cropX, realW + padX * 2)
      const cropH = Math.min(h - cropY, realH + padY * 2)

      const destCanvas = document.createElement('canvas')
      destCanvas.width = cropW
      destCanvas.height = cropH
      const destCtx = destCanvas.getContext('2d')!

      destCtx.fillStyle = '#FFFFFF'
      destCtx.fillRect(0, 0, cropW, cropH)
      
      destCtx.drawImage(
        origCanvas,
        cropX, cropY, cropW, cropH,
        0, 0, cropW, cropH
      )

      resolve(destCanvas.toDataURL('image/png'))
    }

    img.src = imagemUrl
  })
}
