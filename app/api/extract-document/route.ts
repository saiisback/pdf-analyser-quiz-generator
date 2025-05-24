import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import { v4 as uuidv4 } from "uuid";
import PDFParser from "pdf2json";
import path from "path";
import os from "os";

export async function POST(req: NextRequest) {
  const formData: FormData = await req.formData();
  const uploadedFiles = formData.getAll("file");
  
  let fileName = "";
  let parsedText = "";

  if (uploadedFiles && uploadedFiles.length > 0) {
    const uploadedFile = uploadedFiles[0];

    // Check if uploadedFile is of type File
    if (uploadedFile instanceof File) {
      // Generate a unique filename
      fileName = uuidv4();
      
      // Create a temporary directory
      const tempDir = path.join(os.tmpdir(), fileName);
      await fs.mkdir(tempDir, { recursive: true });
      
      const tempFilePath = path.join(tempDir, `${fileName}.pdf`);

      // Convert ArrayBuffer to Buffer
      const fileBuffer = Buffer.from(await uploadedFile.arrayBuffer());

      // Save the buffer as a file
      await fs.writeFile(tempFilePath, fileBuffer);

      // Parse PDF
      parsedText = await extractPdfText(tempFilePath);
      
      // Clean up the temporary files
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch (error) {
        console.error("Failed to delete temporary directory:", error);
      }
    } else {
      console.log("Uploaded file is not in the expected format.");
    }
  } else {
    console.log("No files found.");
  }

  return new NextResponse(
    JSON.stringify({
      fileName,
      parsedText
    }),
  );
}

// Function to extract text from PDF
async function extractPdfText(filePath: string): Promise<string> {
  const pdfParser = new (PDFParser as any)(null, 1);

  return new Promise((resolve, reject) => {
    pdfParser.on("pdfParser_dataReady", () => {
      const text = (pdfParser as any).getRawTextContent();
      resolve(text);
    });

    pdfParser.on("pdfParser_dataError", (errData: any) => {
      reject(errData.parserError);
    });

    pdfParser.loadPDF(filePath);
  });
}