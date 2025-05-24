import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import { v4 as uuidv4 } from "uuid";
import PDFParser from "pdf2json";

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

      // Convert the uploaded file into a temporary file
      const tempFilePath = `/tmp/${fileName}.pdf`;

      // Convert ArrayBuffer to Buffer
      const fileBuffer = Buffer.from(await uploadedFile.arrayBuffer());

      // Save the buffer as a file
      await fs.writeFile(tempFilePath, fileBuffer);

      // Parse the pdf using pdf2json
      const pdfParser = new (PDFParser as any)(null, 1);

      const getParsedText = () => {
        return new Promise((resolve, reject) => {
          pdfParser.on("pdfParser_dataReady", () => {
            const text = (pdfParser as any).getRawTextContent();
            resolve(text);
          });

          pdfParser.on("pdfParser_dataError", (errData: any) => {
            reject(errData.parserError);
          });

          pdfParser.loadPDF(tempFilePath);
        });
      };

      parsedText = (await getParsedText()) as string;
      
      // Clean up the temporary file
      try {
        await fs.unlink(tempFilePath);
      } catch (error) {
        console.error("Failed to delete temporary file:", error);
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
      parsedText,
    }),
  );
}