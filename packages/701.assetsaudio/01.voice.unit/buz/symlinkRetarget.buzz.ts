import fs from 'fs-extra';
import path from 'path';

export const retargetActiveSymlink = async (
  destActiveDir: string,
  characterSlug: string,
  versionedFileName: string,
  conditionTag?: string,
): Promise<string> => {
  await fs.ensureDir(destActiveDir);

  const linkName = conditionTag
    ? `${characterSlug}--${conditionTag}.wav`
    : `${characterSlug}.wav`;

  const activeSymlinkPath = path.join(destActiveDir, linkName);
  const relativeTarget = path.join('..', 'versions', versionedFileName);

  const nonce = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const stageLinkPath = path.join(destActiveDir, `.tmp_link_${nonce}.wav`);

  // Create temporary symlink first
  await fs.symlink(relativeTarget, stageLinkPath);

  // Atomic POSIX rename over the active link pointer
  await fs.rename(stageLinkPath, activeSymlinkPath);

  return activeSymlinkPath;
};
