import { BlobSASPermissions, BlobServiceClient } from '@azure/storage-blob';

export async function createUploadSasUrl(fileName: string) {
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME || 'uploads-temp';

  if (!connectionString) {
    throw new Error('AZURE_STORAGE_CONNECTION_STRING não configurada. Configure a variável ou pule o upload temporário em ambiente local.');
  }

  const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
  const containerClient = blobServiceClient.getContainerClient(containerName);
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
