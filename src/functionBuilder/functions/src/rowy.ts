import { getSecret } from "./utils";
import { url2storage, data2storage } from "./utils/storage";
type RowyFile = {
  downloadURL: string;
  name: string;
  type: string;
  lastModifiedTS: number;
};
type RowyUser = {
  email: any;
  emailVerified: boolean;
  displayName: string;
  photoURL: string;
  uid: string;
  timestamp: number;
};
type uploadOptions = {
  bucket?: string;
  folderPath?: string;
  fileName?: string;
};
interface Rowy {
  metadata: {
    projectId: () => Promise<string>;
    projectNumber: () => Promise<string>;
    serviceAccountEmail: () => Promise<string>;
    serviceAccountUser: () => Promise<RowyUser>;
  };
  secrets: {
    get: (name: string, version?: string) => Promise<string | any | undefined>;
  };
  storage: {
    upload: {
      url: (
        url: string,
        options?: uploadOptions
      ) => Promise<RowyFile | undefined>;
      data: (
        data: Buffer | string,
        options?: uploadOptions
      ) => Promise<RowyFile | undefined>;
    };
  };
}

const rowy: Rowy = {
  metadata: {
    projectId: async () => process.env.GCLOUD_PROJECT,
    projectNumber: async () => "",
    serviceAccountEmail: async () =>
      `${process.env.GCLOUD_PROJECT}@appspot.gserviceaccount.com`,
    serviceAccountUser: async () => ({
      email: `${process.env.GCLOUD_PROJECT}@appspot.gserviceaccount.com`,
      emailVerified: true,
      displayName: "Default Service Account",
      photoURL: "",
      uid: `serviceAccount:${process.env.GCLOUD_PROJECT}@appspot.gserviceaccount.com`,
      timestamp: new Date().getTime(),
    }),
  },
  secrets: {
    get: getSecret,
  },
  storage: {
    upload: {
      url: url2storage,
      data: data2storage,
    },
  },
};
export default rowy;
