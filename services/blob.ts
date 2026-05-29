// Este arquivo cuida dos arquivos temporarios no Azure Blob Storage.
// Ele cria URLs temporarias para upload e tambem apaga o arquivo depois que a analise termina.
// A connection string fica sempre no servidor, nunca no navegador.
import { BlobSASPermissions, BlobServiceClient } from '@azure/storage-blob';

function storageClients(containerName = process.env.AZURE_STORAGE_CONTAINER_NAME || 'uploads-temp') {
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;

  if (!connectionString) {
    throw new Error('AZURE_STORAGE_CONNECTION_STRING não configurada. Configure a variável ou pule o upload temporário em ambiente local.');
  }

  const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
  const containerClient = blobServiceClient.getContainerClient(containerName);
  return { containerClient, containerName };
}

export async function createUploadSasUrl(fileName: string) {
  const { containerClient, containerName } = storageClients();
  await containerClient.createIfNotExists();

  const safeFileName = fileName.replace(/[^a-zA-Z0-9_.-]/g, '_');
  const blobName = `${Date.now()}-${crypto.randomUUID()}-${safeFileName}`;
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);

  const sasUrl = await blockBlobClient.generateSasUrl({
    permissions: BlobSASPermissions.parse('cw'),
    expiresOn: new Date(Date.now() + 60 * 60 * 1000),
    contentType: 'application/octet-stream'
  });

  return { sasUrl, blobName, containerName };
}

export async function uploadTemporaryBlob(fileName: string, contentType: string, content: Uint8Array) {
  // Este upload acontece no servidor.
  // Assim o navegador nao precisa chamar o Blob Storage diretamente e nao depende de CORS no container.
  const { containerClient, containerName } = storageClients();
  await containerClient.createIfNotExists();

  const safeFileName = fileName.replace(/[^a-zA-Z0-9_.-]/g, '_');
  const blobName = `${Date.now()}-${crypto.randomUUID()}-${safeFileName}`;
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);
  await blockBlobClient.uploadData(content, {
    blobHTTPHeaders: { blobContentType: contentType || 'application/octet-stream' }
  });

  return { blobName, containerName };
}

export async function deleteUploadedBlob(blobName: string) {
  // O nome do blob foi gerado pela propria aplicacao.
  // Mesmo assim, validamos para impedir tentativa de apagar caminho estranho ou outro container.
  const safeBlobName = blobName.trim();
  if (!/^[a-zA-Z0-9_.-]+$/.test(safeBlobName)) {
    throw new Error('Nome de arquivo temporário inválido.');
  }

  const { containerClient, containerName } = storageClients();
  const blockBlobClient = containerClient.getBlockBlobClient(safeBlobName);
  const result = await blockBlobClient.deleteIfExists({ deleteSnapshots: 'include' });
  return { deleted: Boolean(result.succeeded), blobName: safeBlobName, containerName };
}
