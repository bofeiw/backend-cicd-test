import { asyncExecute } from "../terminalUtils";
import {
  getCollectionType,
  getCollectionPath,
  getFunctionName,
  getTriggerPath,
  getSchemaPaths,
} from "./utils";
import generateConfig from "./compiler";
import { commandErrorHandler, createStreamLogger } from "./logger";
import firebase from "firebase-admin";
import { getProjectId } from "../metadataService";
import { db } from "../firebaseConfig";

export const functionBuilder = async (
  req: any,
  user: firebase.auth.UserRecord
) => {
  try {
    const { tablePath, tableConfigPath } = req.body;
    const pathname = req.body.pathname.substring(1);
    if (!pathname || !tablePath)
      return { success: false, message: `missing pathname or tablePath` };
    // get settings Document
    const settings = await db.doc(`_rowy_/settings`).get();
    const tables = settings.get("tables");
    const collectionType = getCollectionType(pathname);
    const collectionPath = getCollectionPath(
      collectionType,
      tablePath,
      pathname,
      tables
    );

    const region = settings.get("cloudFunctionsRegion") ?? "us-central1";
    const table = tables.find((t: any) => t.collection === tablePath);
    const functionName = getFunctionName(
      collectionType,
      collectionPath,
      table?.triggerDepth
    );
    const functionConfigPath = `_rowy_/settings/functions/${functionName}`;

    const streamLogger = await createStreamLogger(functionConfigPath);
    await streamLogger.info(`Build started`);
    const buildFolderTimestamp = Date.now();
    const buildPath = `build/functionBuilder/builds/${buildFolderTimestamp}`;

    try {
      const triggerPath = getTriggerPath(
        collectionType,
        collectionPath,
        table?.triggerDepth
      );
      const tableSchemaPaths = getSchemaPaths({
        collectionType,
        collectionPath,
        tables,
        tableConfigPath,
      });
      const projectId = process.env.DEV
        ? require("../../firebase-adminsdk.json").project_id
        : await getProjectId();
      await Promise.all([
        db
          .doc(functionConfigPath)
          .set({ updatedAt: new Date() }, { merge: true }),
        db.doc(tableConfigPath).update({
          functionConfigPath,
        }),
      ]);

      // duplicate functions folder to build folder
      await streamLogger.info(`Duplicating functions template to ${buildPath}`);
      await asyncExecute(
        `mkdir -m 777 -p ${buildPath}; cp -Rp build/functionBuilder/functions/* ${buildPath}`,
        commandErrorHandler({ user }, streamLogger)
      );

      const success = await generateConfig(
        {
          functionConfigPath,
          tableSchemaPaths,
          functionName,
          triggerPath,
          region,
        },
        user,
        streamLogger,
        buildPath,
        buildFolderTimestamp
      );
      if (!success) {
        await streamLogger.error("generateConfig failed");
        await streamLogger.fail();
        return {
          success: false,
          reason: `generateConfig failed to complete`,
        };
      }

      await streamLogger.info("Installing dependencies...");
      await asyncExecute(
        `cd ${buildPath}; yarn install`,
        commandErrorHandler({ user }, streamLogger)
      );

      await streamLogger.info(`Deploying ${functionName} to ${projectId}`);
      await asyncExecute(
        `cd ${buildPath}; yarn deploy --project ${projectId} --only functions`,
        commandErrorHandler({ user }, streamLogger),
        streamLogger
      );
      await streamLogger.end();
      return {
        success: true,
      };
    } catch (error) {
      console.log(error);
      await streamLogger.error("Build Failed:\n" + JSON.stringify(error));
      await streamLogger.fail();
      return {
        success: false,
        reason: `generateConfig failed to complete`,
      };
    }
  } catch (error) {
    console.log(error);
    return {
      success: false,
      reason: `function builder failed`,
    };
  }
};
