import { Octokit } from '@octokit/rest';

/**
 * Commits a solution source file to a user's GitHub repository.
 */
export async function commitSolutionToGitHub({
  token,
  owner,
  repo,
  platform,
  problemId,
  problemTitle,
  code,
  language,
  filePath,
}) {
  if (!token || !owner || !repo) {
    throw new Error('Missing required GitHub configuration (token, owner, repo)');
  }

  const octokit = new Octokit({ auth: token });

  // Map common language names to extensions if filePath not fully formatted
  const extMap = {
    javascript: 'js',
    typescript: 'ts',
    python: 'py',
    python3: 'py',
    cpp: 'cpp',
    c: 'c',
    java: 'java',
    golang: 'go',
    rust: 'rs',
  };

  const ext = extMap[language.toLowerCase()] || 'txt';
  const sanitizedTitle = problemTitle.replace(/[^a-zA-Z0-9_-]/g, '_');
  const targetPath = filePath || `${platform}/${problemId}_${sanitizedTitle}.${ext}`;

  // Check if file already exists to get SHA for update
  let sha;
  try {
    const existingFile = await octokit.rest.repos.getContent({
      owner,
      repo,
      path: targetPath,
    });

    if (!Array.isArray(existingFile.data)) {
      sha = existingFile.data.sha;
    }
  } catch (err) {
    // 404 file does not exist, creating new file
  }

  const commitMessage = `Sync [${platform}] ${problemId} - ${problemTitle}`;
  const contentBase64 = Buffer.from(code).toString('base64');

  const response = await octokit.rest.repos.createOrUpdateFileContents({
    owner,
    repo,
    path: targetPath,
    message: commitMessage,
    content: contentBase64,
    sha,
  });

  return {
    commitSha: response.data.commit.sha,
    filePath: targetPath,
    url: response.data.content.html_url,
  };
}
