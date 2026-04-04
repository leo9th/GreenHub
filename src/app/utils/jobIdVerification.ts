import { isValidNigeriaIdNumber, nameAppearsInOcrText, type NigeriaGovIdType } from "./nigeriaGovId";

export const JOB_VERIFY_FAIL_MESSAGE =
  "ID verification failed. Please upload a valid government-issued ID and a clear selfie showing your face.";

let faceModelsReady = false;
type FaceApiModule = typeof import("face-api.js");

const FACE_MODEL_ROOT = "https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@0.22.2/weights";

async function getFaceApi(): Promise<FaceApiModule> {
  return import("face-api.js");
}

async function ensureFaceModels(faceapi: FaceApiModule): Promise<void> {
  if (faceModelsReady) return;
  faceapi.env.monkeyPatch({
    Canvas: HTMLCanvasElement,
    Image: HTMLImageElement,
    ImageData: ImageData,
  } as typeof faceapi.env);
  await faceapi.nets.ssdMobilenetv1.loadFromUri(FACE_MODEL_ROOT);
  await faceapi.nets.faceLandmark68Net.loadFromUri(FACE_MODEL_ROOT);
  await faceapi.nets.faceRecognitionNet.loadFromUri(FACE_MODEL_ROOT);
  faceModelsReady = true;
}

async function imageFromFile(faceapi: FaceApiModule, file: File): Promise<HTMLImageElement> {
  return faceapi.bufferToImage(file);
}

async function bestFaceDescriptor(faceapi: FaceApiModule, image: HTMLImageElement): Promise<Float32Array | null> {
  await ensureFaceModels(faceapi);
  const dets = await faceapi.detectAllFaces(image).withFaceLandmarks().withFaceDescriptors();
  if (!dets.length) return null;
  dets.sort((a, b) => b.detection.box.area - a.detection.box.area);
  return dets[0].descriptor;
}

async function ocrIdFront(file: File): Promise<string> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng");
  try {
    const {
      data: { text },
    } = await worker.recognize(file);
    return text || "";
  } finally {
    await worker.terminate();
  }
}

export type JobIdVerificationInput = {
  idType: NigeriaGovIdType;
  idNumber: string;
  fullName: string;
  idFrontFile: File;
  selfieFile: File;
};

/**
 * Client-side checks: ID number format, name presence in OCR on front, face similarity ID vs selfie.
 */
export async function runJobIdVerification(input: JobIdVerificationInput): Promise<void> {
  if (!isValidNigeriaIdNumber(input.idType, input.idNumber)) {
    throw new Error(JOB_VERIFY_FAIL_MESSAGE);
  }

  const ocrText = await ocrIdFront(input.idFrontFile);
  if (!nameAppearsInOcrText(input.fullName, ocrText)) {
    throw new Error(JOB_VERIFY_FAIL_MESSAGE);
  }

  const faceapi = await getFaceApi();
  const idImg = await imageFromFile(faceapi, input.idFrontFile);
  const selfieImg = await imageFromFile(faceapi, input.selfieFile);

  const idDesc = await bestFaceDescriptor(faceapi, idImg);
  const selfDesc = await bestFaceDescriptor(faceapi, selfieImg);
  if (!idDesc || !selfDesc) {
    throw new Error(JOB_VERIFY_FAIL_MESSAGE);
  }

  const dist = faceapi.euclideanDistance(idDesc, selfDesc);
  if (dist > 0.52) {
    throw new Error(JOB_VERIFY_FAIL_MESSAGE);
  }
}
