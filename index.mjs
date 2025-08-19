import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import sharp from 'sharp';

const s3 = new S3Client({});

export async function handler(event) {
    try {
        for (const record of event.Records) {
            const messageBody = JSON.parse(record.body);

            if ('Records' in messageBody) {
                for (const s3Event of messageBody.Records) {
                    const bucketOrigem = s3Event.s3.bucket.name;
                    const key = s3Event.s3.object.key;
                    const bucketDestino = "BUCKET_OUPUT_NAME"; 
                    
                    const originalImage = await s3.send(new GetObjectCommand({
                        Bucket: bucketOrigem,
                        Key: key,
                    }));

                    if (!originalImage.Body || originalImage.Body.length === 0) {
                        console.log(`Imagem não encontrada no S3: ${key}`);
                        continue; 
                    }
                    
                    const buffers = [];
                    for await (const chunk of originalImage.Body) {
                        buffers.push(chunk);
                    }
                    const imageBuffer = Buffer.concat(buffers);

                    
                    const fileSizeInMB = imageBuffer.length / (1024 * 1024);
                    if (fileSizeInMB < 2) {
                        console.log(`Imagem ${key} tem menos de 2 MB e não será comprimida.`);
                        continue; 
                    }
                    
                    const imageMetadata = await sharp(imageBuffer).metadata();
                    const format = imageMetadata.format;

                    let compressedImage;
                    if (format === 'jpeg' || format === 'jpg') {
                        
                        compressedImage = await sharp(imageBuffer)
                            .jpeg({ quality: 60 })  
                            .toBuffer();
                    } else if (format === 'png') {
                        
                        compressedImage = await sharp(imageBuffer)
                            .png({ quality: 60, compressionLevel: 9 })  
                            .toBuffer();
                    } else {
                        console.log(`Formato de imagem não suportado: ${format}`);
                        continue; 
                    }
                
                    await s3.send(new PutObjectCommand({
                        Bucket: bucketDestino,
                        Key: key,
                        Body: compressedImage,
                        ContentType: originalImage.ContentType,
                    }));

                    console.log(`Imagem ${key} comprimida e movida com sucesso.`);
                }
            }
        }

        return {
            statusCode: 200,
            body: JSON.stringify('Image processing completed successfully'),
        };
    } catch (error) {
        console.error("Erro ao processar a imagem:", error.message);
        return {
            statusCode: 500,
            body: JSON.stringify(`Error compressing image: ${error.message}`),
        };
    }
};
