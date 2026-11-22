const HEADER_BYTES = 37;
const FLAG_ENCRYPTED = 1;
const FLAG_COMPRESSED = 2;
const INNER_VERSION = 1;
const PBKDF2_ITERATIONS = 210000;
const CORRUPTED_MESSAGE = "Данные повреждены или отсутствуют";
const ACCEPTED_IMAGE_TYPES = new Set([
  "image/png",
  "image/webp",
  "image/bmp",
  "image/gif",
  "image/jpeg"
]);
class SteganographyError extends Error {
  constructor(message) {
    super(message);
    this.name = "SteganographyError";
  }
}
const state = {
  activeTab: "encode",
  encodeMode: "text",
  encodeImageFile: null,
  encodeImageInfo: null,
  encodeImagePreviewUrl: "",
  encodeText: "",
  encodeFile: null,
  encodePassword: "",
  encodeResultUrl: "",
  decodeImageFile: null,
  decodeImagePreviewUrl: "",
  decodePassword: "",
  decodedFileUrl: ""
};
const elements = {
  compatibilityMessage: document.querySelector("#сообщение-совместимости"),
  tabEncode: document.querySelector("#tab-кодировать"),
  tabDecode: document.querySelector("#tab-декодировать"),
  panelEncode: document.querySelector("#панель-кодировать"),
  panelDecode: document.querySelector("#panel-decode"),
  encodeImageInput: document.querySelector("#encode-image-input"),
  encodeDropzone: document.querySelector("#encode-dropzone"),
  encodeDropzoneMeta: document.querySelector("#encode-dropzone-meta"),
  encodeImagePreview: document.querySelector("#encode-image-preview"),
  encodePreviewImage: document.querySelector("#encode-preview-image"),
  encodeImageStatus: document.querySelector("#кодировать-изображение-статус"),
  contentModeText: document.querySelector("#content-mode-text"),
  contentModeFile: document.querySelector("#content-mode-file"),
  contentTextPanel: document.querySelector("#content-text-panel"),
  contentFilePanel: document.querySelector("#content-file-panel"),
  hiddenText: document.querySelector("#скрытый-текст"),
  textSizeHint: document.querySelector("#text-size-hint"),
  hiddenFileInput: document.querySelector("#скрытый-файл-ввод"),
  hiddenFileMeta: document.querySelector("#скрытый-файл-мета"),
  clearHiddenFile: document.querySelector("#очистить-скрытый-файл"),
  encodePassword: document.querySelector("#кодировать-пароль"),
  encodeButton: document.querySelector("#кнопка кодирования"),
  encodeMessage: document.querySelector("#кодировать-сообщение"),
  encodeResultPreview: document.querySelector("#encode-result-preview"),
  encodeResultImage: document.querySelector("#кодировать-результат-изображение"),
  downloadResultLink: document.querySelector("#ссылка на результат загрузки"),
  decodeImageInput: document.querySelector("#decode-image-input"),
  decodeDropzone: document.querySelector("#decode-dropzone"),
  decodeDropzoneMeta: document.querySelector("#decode-dropzone-meta"),
  decodeImagePreview: document.querySelector("#decode-image-preview"),
  decodePreviewImage: document.querySelector("#decode-preview-image"),
  decodeImageStatus: document.querySelector("#декодировать-изображение-статус"),
  decodePassword: document.querySelector("#декодировать-пароль"),
  decodeButton: document.querySelector("#кнопка декодирования"),
  decodeMessage: document.querySelector("#декодирование-сообщение"),
  decodedTextCard: document.querySelector("#декодированная-текстовая-карта"),
  decodedText: document.querySelector("#декодированный-текст"),
  decodedFileCard: document.querySelector("#декодированная-файловая-карта"),
  decodedFileMeta: document.querySelector("#декодированный-файл-мета"),
  decodedFileLink: document.querySelector("#декодированная-ссылка на файл")
};
init();
function init() {
  if (!isBrowserSupported()) {
    document.documentElement.dataset.app = "unsupported";
    showCompatibilityMessage(
      "Этот браузер не поддерживает нужные API. Для работы приложения нужны Web Crypto API и Canvas API."
    );
    return;
  }
  bindTabs();
  bindDropzone(elements.encodeDropzone, (files) => setEncodeImage(files[0] ?? null));
  bindDropzone(elements.decodeDropzone, (files) => setDecodeImage(files[0] ?? null));
  elements.encodeImageInput.addEventListener("change", () => {
    setEncodeImage(elements.encodeImageInput.files?.[0] ?? null);
  });
  elements.decodeImageInput.addEventListener("change", () => {
    setDecodeImage(elements.decodeImageInput.files?.[0] ?? null);
  });
  elements.contentModeText.addEventListener("click", () => switchEncodeMode("text"));
  elements.contentModeFile.addEventListener("click", () => switchEncodeMode("file"));
  elements.hiddenText.addEventListener("input", () => {
    state.encodeText = elements.hiddenText.value;
    updateTextSizeHint();
    clearEncodeNotice();
  });
  elements.hiddenFileInput.addEventListener("change", () => {
    state.encodeFile = elements.hiddenFileInput.files?.[0] ?? null;
    renderEncodeFileMeta();
    clearEncodeNotice();
  });
  elements.clearHiddenFile.addEventListener("click", () => {
    state.encodeFile = null;
    elements.hiddenFileInput.value = "";
    renderEncodeFileMeta();
    clearEncodeNotice();
  });
  elements.encodePassword.addEventListener("input", () => {
    state.encodePassword = elements.encodePassword.value;
    clearEncodeNotice();
  });
  elements.decodePassword.addEventListener("input", () => {
    state.decodePassword = elements.decodePassword.value;
    clearDecodeNotice();
  });
  elements.encodeButton.addEventListener("click", handleEncode);
  elements.decodeButton.addEventListener("click", handleDecode);
  switchEncodeMode("text");
  setActiveTab("encode");
  updateTextSizeHint();
  renderEncodeFileMeta();
  renderEncodeImageStatus();
  renderDecodeImageStatus();
  document.documentElement.dataset.app = "ready";
}
function isBrowserSupported() {
  return Boolean(
    window.crypto?.subtle &&
      window.TextEncoder &&
      window.TextDecoder &&
      document.createElement("canvas").getContext
  );
}
function showCompatibilityMessage(message) {
  elements.compatibilityMessage.className = "card";
  elements.compatibilityMessage.innerHTML = `
    <h1 class="title">Браузер не поддерживается</h1>
    <p class="subtitle">${escapeHtml(message)}</p>
  `;
}
function bindTabs() {
  elements.tabEncode.addEventListener("click", () => setActiveTab("encode"));
  elements.tabDecode.addEventListener("click", () => setActiveTab("decode"));
}
function setActiveTab(tab) {
  const isEncode = tab === "encode";
  state.activeTab = tab;
  elements.tabEncode.setAttribute("aria-selected", String(isEncode));
  elements.tabDecode.setAttribute("aria-selected", String(!isEncode));
  elements.panelEncode.classList.toggle("hidden", !isEncode);
  elements.panelDecode.classList.toggle("hidden", isEncode);
}
function bindDropzone(dropzone, onFiles) {
  ["dragenter", "dragover"].forEach((eventName) => {
    dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropzone.classList.add("is-dragover");
    });
  });
  ["dragleave", "dragend", "drop"].forEach((eventName) => {
    dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropzone.classList.remove("is-dragover");
    });
  });
  dropzone.addEventListener("drop", (event) => {
    onFiles(Array.from(event.dataTransfer?.files ?? []));
  });
}
function switchEncodeMode(mode) {
  const isText = mode === "text";
  state.encodeMode = mode;
  elements.contentModeText.classList.toggle("is-active", isText);
  elements.contentModeText.setAttribute("aria-pressed", String(isText));
  elements.contentModeFile.classList.toggle("is-active", !isText);
  elements.contentModeFile.setAttribute("aria-pressed", String(!isText));
  elements.contentTextPanel.classList.toggle("hidden", !isText);
  elements.contentFilePanel.classList.toggle("hidden", isText);
  clearEncodeNotice();
}
async function setEncodeImage(file) {
  clearEncodeResult();
  clearEncodeNotice();
  if (!file) {
    revokeUrl("encodeImagePreviewUrl");
    state.encodeImageFile = null;
    state.encodeImageInfo = null;
    elements.encodeImageInput.value = "";
    elements.encodeImagePreview.classList.add("hidden");
    elements.encodeDropzoneMeta.textContent =
      "Подходят популярные растровые форматы. После кодирования скачивается новый PNG.";
    renderEncodeImageStatus();
    return;
  }
  try {
    assertSupportedImage(file);
    state.encodeImageInfo = await readImageInfo(file);
    state.encodeImageFile = file;
    setPreviewUrl("encodeImagePreviewUrl", file, elements.encodePreviewImage, elements.encodeImagePreview);
    elements.encodeDropzoneMeta.textContent = `${file.name} · ${formatBytes(file.size)}`;
    renderEncodeImageStatus();
  } catch (error) {
    state.encodeImageFile = null;
    state.encodeImageInfo = null;
    elements.encodeImageInput.value = "";
    elements.encodeImagePreview.classList.add("hidden");
    renderEncodeImageStatus();
    showNotice(elements.encodeMessage, "error", toUserMessage(error));
  }
}
async function setDecodeImage(file) {
  clearDecodeResult();
  clearDecodeNotice();
  if (!file) {
    revokeUrl("decodeImagePreviewUrl");
    state.decodeImageFile = null;
    elements.decodeImageInput.value = "";
    elements.decodeImagePreview.classList.add("hidden");
    elements.decodeDropzoneMeta.textContent =
      "Лучше использовать исходный файл без повторного сжатия и конвертации.";
    renderDecodeImageStatus();
    return;
  }
  try {
    assertSupportedImage(file);
    state.decodeImageFile = file;
    setPreviewUrl("decodeImagePreviewUrl", file, elements.decodePreviewImage, elements.decodeImagePreview);
    elements.decodeDropzoneMeta.textContent = `${file.name} · ${formatBytes(file.size)}`;
    renderDecodeImageStatus();
  } catch (error) {
    state.decodeImageFile = null;
    elements.decodeImageInput.value = "";
    elements.decodeImagePreview.classList.add("hidden");
    renderDecodeImageStatus();
    showNotice(elements.decodeMessage, "error", toUserMessage(error));
  }
}
function setPreviewUrl(stateKey, file, imageElement, previewElement) {
  revokeUrl(stateKey);
  const url = URL.createObjectURL(file);
  state[stateKey] = url;
  imageElement.src = url;
  previewElement.classList.remove("hidden");
}
function revokeUrl(stateKey) {
  if (!state[stateKey]) {
    return;
  }
  URL.revokeObjectURL(state[stateKey]);
  state[stateKey] = "";
}
function renderEncodeImageStatus() {
  elements.encodeImageStatus.innerHTML = "";
  if (!state.encodeImageFile || !state.encodeImageInfo) {
    return;
  }
  appendPill(elements.encodeImageStatus, "таблетка таблетка – успех", "Картинка загружена");
  appendPill(
    elements.encodeImageStatus,
    "pill",
    `${state.encodeImageInfo.width} × ${state.encodeImageInfo.height} пикселей`
  );
  appendPill(
    elements.encodeImageStatus,
    "pill",
    `К ${formatBytes(getAvailableBytes(state.encodeImageInfo.width, state.encodeImageInfo.height))}`
  );
}
function renderDecodeImageStatus() {
  elements.decodeImageStatus.innerHTML = "";
  if (!state.decodeImageFile) {
    return;
  }
  appendPill(elements.decodeImageStatus, "таблетка таблетка – успех", "Картинка загружена");
}
function renderEncodeFileMeta() {
  if (!state.encodeFile) {
    elements.clearHiddenFile.classList.add("hidden");
    elements.hiddenFileMeta.className = "уведомление уведомление-информация";
    elements.hiddenFileMeta.textContent = "Файл пока не выбран.";
    return;
  }
  elements.clearHiddenFile.classList.remove("hidden");
  elements.hiddenFileMeta.className = "file-chip";
  elements.hiddenFileMeta.textContent = `${state.encodeFile.name} · ${formatBytes(state.encodeFile.size)}`;
}
function updateTextSizeHint() {
  elements.textSizeHint.textContent = formatBytes(utf8Encode(elements.hiddenText.value).length);
}
async function handleEncode() {
  clearEncodeNotice();
  clearEncodeResult();
  if (!state.encodeImageFile || !state.encodeImageInfo) {
    showNotice(elements.encodeMessage, "error", "Сначала загрузите изображение-контейнер.");
    return;
  }
  let content;
  try {
    content = await getSelectedContent();
  } catch (error) {
    showNotice(elements.encodeMessage, "error", toUserMessage(error));
    return;
  }
  setBusy(elements.encodeButton, true, "Кодирование...");
  showNotice(
    elements.encodeMessage,
    "info",
    "Подготавливаем полезную нагрузку, сжимаем данные и записываем биты в RGB-каналы..."
  );
  try {
    const payloadInfo = await buildEncodedPayload(content, state.encodePassword.trim());
    const availableBytes = getAvailableBytes(state.encodeImageInfo.width, state.encodeImageInfo.height);
    if (payloadInfo.totalBytes > availableBytes) {
      throw new SteganographyError(
        `Недостаточно места в изображении. Доступно ${formatBytes(availableBytes)}, требуется ${formatBytes(payloadInfo.totalBytes)}.`
      );
    }
    const source = await readImageDataFromFile(state.encodeImageFile);
    const outputImageData = embedPayload(source.imageData, payloadInfo.containerBytes);
    const blob = await imageDataToPngBlob(outputImageData);
    revokeUrl("encodeResultUrl");
    state.encodeResultUrl = URL.createObjectURL(blob);
    elements.downloadResultLink.href = state.encodeResultUrl;
    elements.downloadResultLink.download = getEncodedFileName(state.encodeImageFile.name);
    elements.downloadResultLink.classList.remove("hidden");
    elements.encodeResultImage.src = state.encodeResultUrl;
    elements.encodeResultPreview.classList.remove("hidden");
    showNotice(
      elements.encodeMessage,
      "success",
      `Кодирование завершено. Итоговый контейнер занимает ${formatBytes(payloadInfo.totalBytes)} из ${formatBytes(availableBytes)}.`
    );
  } catch (error) {
    showNotice(elements.encodeMessage, "error", toUserMessage(error));
  } finally {
    setBusy(elements.encodeButton, false, "Спрятать данные");
  }
}
async function handleDecode() {
  clearDecodeNotice();
  clearDecodeResult();
  if (!state.decodeImageFile) {
    showNotice(elements.decodeMessage, "error", "Сначала загрузите изображение для извлечения.");
    return;
  }
  setBusy(elements.decodeButton, true, "Извлечение...");
  showNotice(
    elements.decodeMessage,
    "info",
    "Извлекаем биты из RGB-каналов, проверяем SHA-256 и восстанавливаем содержимое..."
  );
  try {
    const decoded = await decodeFromImage(state.decodeImageFile, state.decodePassword.trim());
    if (decoded.kind === "text") {
      elements.decodedText.textContent = decoded.text;
      elements.decodedTextCard.classList.remove("hidden");
      showNotice(elements.decodeMessage, "success", "Текст успешно извлечён и прошёл проверку целостности.");
      return;
    }
    if (state.decodedFileUrl) {
      URL.revokeObjectURL(state.decodedFileUrl);
      state.decodedFileUrl = "";
    }
    state.decodedFileUrl = URL.createObjectURL(decoded.blob);
    elements.decodedFileMeta.textContent = `${decoded.fileName} · ${formatBytes(decoded.size)} · ${decoded.mimeType}`;
    elements.decodedFileLink.href = state.decodedFileUrl;
    elements.decodedFileLink.download = decoded.fileName;
    elements.decodedFileCard.classList.remove("hidden");
    showNotice(elements.decodeMessage, "success", "Файл успешно извлечён и готов к скачиванию.");
  } catch (error) {
    showNotice(elements.decodeMessage, "error", toUserMessage(error));
  } finally {
    setBusy(elements.decodeButton, false, "Извлечь данные");
  }
}
async function getSelectedContent() {
  if (state.encodeMode === "text") {
    const text = elements.hiddenText.value;
    if (!text.length) {
      throw new SteganographyError("Введите текст или переключитесь на режим файла.");
    }
    return {
      kind: "text",
      fileName: "",
      mimeType: "текст/обычная;кодировка=utf-8",
      data: utf8Encode(text)
    };
  }
  if (!state.encodeFile) {
    throw new SteganographyError("Выберите файл, который нужно спрятать.");
  }
  if (state.encodeFile.size === 0) {
    throw new SteganographyError("Файл для скрытия пустой. Выберите другой файл.");
  }
  return {
    kind: "file",
    fileName: state.encodeFile.name,
    mimeType: state.encodeFile.type || "application/octet-stream",
    data: new Uint8Array(await state.encodeFile.arrayBuffer())
  };
}
async function buildEncodedPayload(content, password) {
  const innerEnvelope = buildInnerEnvelope(content);
  const compressedResult = await maybeCompressBytes(innerEnvelope);
  const encrypted = Boolean(password);
  const payload = encrypted ? await encryptPayload(compressedResult.bytes, password) : compressedResult.bytes;
  const hash = await sha256(payload);
  const containerBytes = concatBytes(
    uint32ToBytes(payload.length),
    hash,
    Uint8Array.of(
      (encrypted ? FLAG_ENCRYPTED : 0) |
      (compressedResult.compressed ? FLAG_COMPRESSED : 0)
    ),
    payload
  );
  return {
    containerBytes,
    totalBytes: containerBytes.length
  };
}
function buildInnerEnvelope(content) {
  const kind = content.kind === "text" ? 1 : 2;
  const fileNameBytes = utf8Encode(content.fileName);
  const mimeTypeBytes = utf8Encode(content.mimeType);
  if (fileNameBytes.length > 65535 || mimeTypeBytes.length > 65535) {
    throw new SteganographyError("Имя файла или MIME-тип слишком длинные для выбранного формата.");
  }
  const header = new Uint8Array(10);
  const view = new DataView(header.buffer);
  view.setUint8(0, INNER_VERSION);
  view.setUint8(1, kind);
  view.setUint16(2, fileNameBytes.length, false);
  view.setUint16(4, mimeTypeBytes.length, false);
  view.setUint32(6, content.data.length, false);
  return concatBytes(header, fileNameBytes, mimeTypeBytes, content.data);
}
async function decodeFromImage(file, password) {
  assertSupportedImage(file);
  const { imageData, width, height } = await readImageDataFromFile(file);
  const availableBytes = getAvailableBytes(width, height);
  if (availableBytes < HEADER_BYTES) {
    throw new SteganographyError(CORRUPTED_MESSAGE);
  }
  const headerBytes = extractPayload(imageData.data, HEADER_BYTES, 0);
  const view = new DataView(headerBytes.buffer, headerBytes.byteOffset, headerBytes.byteLength);
  const payloadLength = view.getUint32(0, false);
  const expectedHash = headerBytes.slice(4, 36);
  const flags = headerBytes[36];
  if ((flags & ~(FLAG_ENCRYPTED | FLAG_COMPRESSED)) !== 0 || payloadLength <= 0 || payloadLength > availableBytes - HEADER_BYTES) {
    throw new SteganographyError(CORRUPTED_MESSAGE);
  }
  const encrypted = (flags & FLAG_ENCRYPTED) === FLAG_ENCRYPTED;
  const compressed = (flags & FLAG_COMPRESSED) === FLAG_COMPRESSED;
  if (encrypted && !password) {
    throw new SteganographyError("Для этого изображения нужен пароль.");
  }
  const payload = extractPayload(imageData.data, payloadLength, HEADER_BYTES);
  if (!bytesEqual(expectedHash, await sha256(payload))) {
    throw new SteganographyError(CORRUPTED_MESSAGE);
  }
  const unpackSource = encrypted ? await decryptPayload(payload, password) : payload;
  let decodedEnvelope;
  try {
    decodedEnvelope = compressed
      ? await decompressBytes(unpackSource)
      : await tryDecompressOrUseRaw(unpackSource);
  } catch (error) {
    throw new SteganographyError(CORRUPTED_MESSAGE);
  }
  return parseInnerEnvelope(decodedEnvelope);
}
function parseInnerEnvelope(bytes) {
  if (bytes.length < 10) {
    throw new SteganographyError(CORRUPTED_MESSAGE);
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const version = view.getUint8(0);
  const kind = view.getUint8(1);
  const fileNameLength = view.getUint16(2, false);
  const mimeTypeLength = view.getUint16(4, false);
  const dataLength = view.getUint32(6, false);
  if (version !== INNER_VERSION || (kind !== 1 && kind !== 2)) {
    throw new SteganographyError(CORRUPTED_MESSAGE);
  }
  const totalLength = 10 + fileNameLength + mimeTypeLength + dataLength;
  if (totalLength !== bytes.length) {
    throw new SteganographyError(CORRUPTED_MESSAGE);
  }
  let offset = 10;
  const fileName = utf8Decode(bytes.slice(offset, offset + fileNameLength));
  offset += fileNameLength;
  const mimeType = utf8Decode(bytes.slice(offset, offset + mimeTypeLength));
  offset += mimeTypeLength;
  const dataBytes = bytes.slice(offset, offset + dataLength);
  if (kind === 1) {
    return {
      kind: "text",
      text: utf8Decode(dataBytes),
      size: dataBytes.length
    };
  }
  return {
    kind: "file",
    fileName: fileName || "hidden-file.bin",
    mimeType: mimeType || "application/octet-stream",
    size: dataBytes.length,
    blob: new Blob([dataBytes], { type: mimeType || "application/octet-stream" })
  };
}
function embedPayload(imageData, payloadBytes) {
  const cloned = new Uint8ClampedArray(imageData.data);
  const totalBits = payloadBytes.length * 8;
  let bitIndex = 0;
  for (let index = 0; index < cloned.length && bitIndex < totalBits; index += 1) {
    if ((index + 1) % 4 === 0) {
      continue;
    }
    const bit = (payloadBytes[bitIndex >> 3] >> (7 - (bitIndex & 7))) & 1;
    cloned[index] = (cloned[index] & 0xfe) | bit;
    bitIndex += 1;
  }
  if (bitIndex !== totalBits) {
    throw new SteganographyError("Размер скрываемых данных превышает вместимость изображения.");
  }
  return new ImageData(cloned, imageData.width, imageData.height);
}
function extractPayload(pixelBytes, byteLength, skipBytes) {
  const result = new Uint8Array(byteLength);
  const totalBits = byteLength * 8;
  const bitsToSkip = skipBytes * 8;
  let skippedBits = 0;
  let readBits = 0;
  for (let index = 0; index < pixelBytes.length && readBits < totalBits; index += 1) {
    if ((index + 1) % 4 === 0) {
      continue;
    }
    if (skippedBits < bitsToSkip) {
      skippedBits += 1;
      continue;
    }
    const byteIndex = readBits >> 3;
    result[byteIndex] = (result[byteIndex] << 1) | (pixelBytes[index] & 1);
    readBits += 1;
  }
  if (readBits !== totalBits) {
    throw new SteganographyError(CORRUPTED_MESSAGE);
  }
  return result;
}
async function encryptPayload(bytes, password) {
  const cryptoApi = getCrypto();
  const salt = cryptoApi.getRandomValues(new Uint8Array(16));
  const iv = cryptoApi.getRandomValues(new Uint8Array(12));
  const key = await deriveAesKey(password, salt, ["encrypt"]);
  const encrypted = await cryptoApi.subtle.encrypt(
    { name: "AES-GCM", iv: sliceBuffer(iv) },
    key,
    sliceBuffer(bytes)
  );
  return concatBytes(salt, iv, new Uint8Array(encrypted));
}
async function decryptPayload(bytes, password) {
  if (bytes.length <= 44) {
    throw new SteganographyError(CORRUPTED_MESSAGE);
  }
  const salt = bytes.slice(0, 16);
  const iv = bytes.slice(16, 28);
  const cipherText = bytes.slice(28);
  try {
    const key = await deriveAesKey(password, salt, ["decrypt"]);
    const decrypted = await getCrypto().subtle.decrypt(
      { name: "AES-GCM", iv: sliceBuffer(iv) },
      key,
      sliceBuffer(cipherText)
    );
    return new Uint8Array(decrypted);
  } catch (error) {
    throw new SteganographyError("Не удалось расшифровать данные. Проверьте пароль.");
  }
}
async function deriveAesKey(password, salt, usages) {
  const passwordBytes = utf8Encode(password);
  const baseKey = await getCrypto().subtle.importKey("raw", sliceBuffer(passwordBytes), "PBKDF2", false, ["deriveKey"]);
  return getCrypto().subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: sliceBuffer(salt),
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256"
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    usages
  );
}
async function sha256(bytes) {
  const digest = await getCrypto().subtle.digest("SHA-256", sliceBuffer(bytes));
  return new Uint8Array(digest);
}
async function compressBytes(bytes) {
  const stream = new CompressionStream("deflate");
  const writer = stream.writable.getWriter();
  await writer.write(bytes);
  await writer.close();
  return new Uint8Array(await new Response(stream.readable).arrayBuffer());
}
async function maybeCompressBytes(bytes) {
  if (!window.CompressionStream) {
    return { bytes, compressed: false };
  }
  try {
    const compressed = await withTimeout(compressBytes(bytes), 4000, "compression");
    return { bytes: compressed, compressed: true };
  } catch (error) {
    return { bytes, compressed: false };
  }
}
async function decompressBytes(bytes) {
  const stream = new DecompressionStream("deflate");
  const writer = stream.writable.getWriter();
  await writer.write(bytes);
  await writer.close();
  return new Uint8Array(await new Response(stream.readable).arrayBuffer());
}
async function tryDecompressOrUseRaw(bytes) {
  if (!window.DecompressionStream) {
    return bytes;
  }
  try {
    return await withTimeout(decompressBytes(bytes), 4000, "decompression");
  } catch (error) {
    return bytes;
  }
}
function getCrypto() {
  if (!window.crypto?.subtle) {
    throw new SteganographyError("Ваш браузер не поддерживает Web Crypto API.");
  }
  return window.crypto;
}
function withTimeout(promise, timeoutMs, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      window.setTimeout(() => {
        reject(new SteganographyError(`Тайм-аут операции: ${label}`));
      }, timeoutMs);
    })
  ]);
}
function getAvailableBytes(width, height) {
  return Math.floor((width * height * 3) / 8);
}
async function readImageInfo(file) {
  const image = await loadImage(file);
  return { width: image.naturalWidth, height: image.naturalHeight };
}
async function readImageDataFromFile(file) {
  const image = await loadImage(file);
  const width = image.naturalWidth;
  const height = image.naturalHeight;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    throw new SteganographyError("Canvas API недоступен в текущем браузере.");
  }
  context.drawImage(image, 0, 0);
  return {
    imageData: context.getImageData(0, 0, width, height),
    width,
    height
  };
}
async function imageDataToPngBlob(imageData) {
  const canvas = document.createElement("canvas");
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new SteganographyError("Canvas API недоступен в текущем браузере.");
  }
  context.putImageData(imageData, 0, 0);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new SteganographyError("Не удалось сформировать PNG после кодирования."));
        return;
      }
      resolve(blob);
    }, "image/png");
  });
}
function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new SteganographyError("Не удалось прочитать изображение. Попробуйте выбрать другой файл."));
    };
    image.src = url;
  });
}
function assertSupportedImage(file) {
  const type = (file.type || "").toLowerCase();
  const lowerName = file.name.toLowerCase();
  const isSupported =
    ACCEPTED_IMAGE_TYPES.has(type) ||
    [".png", ".webp", ".bmp", ".gif", ".jpg", ".jpeg"].some((suffix) => lowerName.endsWith(suffix));
  if (!isSupported) {
    throw new SteganographyError("Нужна растровая картинка: PNG, WebP, BMP, GIF или JPEG.");
  }
}
function getEncodedFileName(originalName) {
  return originalName.replace(/\.[^.]+$/, "") + "-encoded.png";
}
function sliceBuffer(bytes) {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}
function concatBytes(...parts) {
  const totalLength = parts.reduce((sum, part) => sum + part.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}
function uint32ToBytes(value) {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value, false);
  return bytes;
}
function bytesEqual(left, right) {
  if (left.length !== right.length) {
    return false;
  }
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return false;
    }
  }
  return true;
}
function utf8Encode(value) {
  return new TextEncoder().encode(value);
}
function utf8Decode(bytes) {
  return new TextDecoder().decode(bytes);
}
function formatBytes(value) {
  if (!Number.isFinite(value) || value < 0) {
    return "0 Б";
  }
  if (value < 1024) {
    return `${value} Б`;
  }
  const units = ["КБ", "МБ", "ГБ"];
  let current = value / 1024;
  let index = 0;
  while (current >= 1024 && index < units.length - 1) {
    current /= 1024;
    index += 1;
  }
  return `${current.toFixed(current >= 10 ? 1 : 2)} ${units[index]}`;
}
function appendPill(container, className, text) {
  const pill = document.createElement("span");
  pill.className = className;
  pill.textContent = text;
  container.appendChild(pill);
}
function showNotice(target, type, message) {
  target.className = `уведомление уведомление--${type}`;
  target.textContent = message;
  target.classList.remove("hidden");
}
function clearEncodeNotice() {
  elements.encodeMessage.className = "hidden";
  elements.encodeMessage.textContent = "";
}
function clearDecodeNotice() {
  elements.decodeMessage.className = "hidden";
  elements.decodeMessage.textContent = "";
}
function clearEncodeResult() {
  if (state.encodeResultUrl) {
    URL.revokeObjectURL(state.encodeResultUrl);
    state.encodeResultUrl = "";
  }
  elements.encodeResultPreview.classList.add("hidden");
  elements.downloadResultLink.classList.add("hidden");
  elements.downloadResultLink.removeAttribute("href");
  elements.encodeResultImage.removeAttribute("src");
}
function clearDecodeResult() {
  elements.decodedTextCard.classList.add("hidden");
  elements.decodedText.textContent = "";
  elements.decodedFileCard.classList.add("hidden");
  elements.decodedFileMeta.textContent = "";
  elements.decodedFileLink.removeAttribute("href");
  if (state.decodedFileUrl) {
    URL.revokeObjectURL(state.decodedFileUrl);
    state.decodedFileUrl = "";
  }
}
function setBusy(button, busy, label) {
  button.disabled = busy;
  button.textContent = label;
}
function toUserMessage(error) {
  if (error instanceof Error) {
    return error.message;
  }
  return "Произошла неизвестная ошибка.";
}
function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
window.addEventListener("beforeunload", () => {
  revokeUrl("encodeImagePreviewUrl");
  revokeUrl("encodeResultUrl");
  revokeUrl("decodeImagePreviewUrl");
  if (state.decodedFileUrl) {
    URL.revokeObjectURL(state.decodedFileUrl);
  }
});