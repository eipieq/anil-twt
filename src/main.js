const sdk = require('node-appwrite');

module.exports = async ({ req, res, log, error }) => {
  try {
    log('Function triggered - Processing tweet update');
    
    // Parse the trigger payload
    let payload;
    try {
      payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      log('Payload received:', JSON.stringify(payload));
    } catch (parseError) {
      error('Error parsing payload:', parseError);
      return res.json({ success: false, error: 'Invalid payload format' }, 400);
    }

    // Extract the updated document data
    const updatedDocument = payload.$id ? payload : payload.data;
    
    if (!updatedDocument || !updatedDocument.text) {
      error('No text field found in updated document');
      return res.json({ success: false, error: 'No text field found' }, 400);
    }

    log('Updated tweet text:', updatedDocument.text);

    // GitHub configuration
    const githubToken = process.env.GITHUB_TOKEN;
    const githubRepo = 'eipieq/anil-tweet-site';
    const filePath = 'index.html';
    const branch = 'main';
    
    // Get current file content from GitHub
    const getFileUrl = `https://api.github.com/repos/${githubRepo}/contents/${filePath}?ref=${branch}`;
    
    log('Fetching current HTML from GitHub...');
    
    const getResponse = await fetch(getFileUrl, {
      headers: {
        'Authorization': `Bearer ${githubToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Appwrite-Function'
      }
    });
    
    if (!getResponse.ok) {
      const errorText = await getResponse.text();
      throw new Error(`GitHub API error (get): ${getResponse.status} - ${errorText}`);
    }
    
    const fileData = await getResponse.json();
    const currentContent = Buffer.from(fileData.content, 'base64').toString('utf8');
    
    log('Current HTML fetched successfully');
    
    // Escape HTML special characters
    const escapeHtml = (text) => {
      return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    };
    
    const escapedText = escapeHtml(updatedDocument.text);
    
    // Update tweet content using regex
    const tweetRegex = /<div class="tweet-text">\s*[\s\S]*?\s*<\/div>/;
    const newTweetHtml = `<div class="tweet-text">
                    ${escapedText}
                </div>`;
    
    if (!tweetRegex.test(currentContent)) {
      throw new Error('Tweet element not found in HTML');
    }
    
    let updatedContent = currentContent.replace(tweetRegex, newTweetHtml);
    
    // Update timestamp if provided
    if (updatedDocument.timestamp) {
      const getTimeAgo = (timestamp) => {
        const now = new Date();
        const tweetTime = new Date(timestamp);
        const diffInMinutes = Math.floor((now - tweetTime) / (1000 * 60));
        
        if (diffInMinutes < 1) return 'now';
        if (diffInMinutes < 60) return `${diffInMinutes}m`;
        if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h`;
        return `${Math.floor(diffInMinutes / 1440)}d`;
      };
      
      const timeAgo = getTimeAgo(updatedDocument.timestamp);
      const timestampRegex = /<span class="timestamp">·\s*.*?<\/span>/;
      const newTimestampHtml = `<span class="timestamp">· ${timeAgo}</span>`;
      
      if (timestampRegex.test(updatedContent)) {
        updatedContent = updatedContent.replace(timestampRegex, newTimestampHtml);
        log('Timestamp updated to:', timeAgo);
      }
    }
    
    // Push updated content to GitHub
    const commitMessage = `Update tweet: ${updatedDocument.text.substring(0, 50)}${updatedDocument.text.length > 50 ? '...' : ''}`;
    
    const updatePayload = {
      message: commitMessage,
      content: Buffer.from(updatedContent).toString('base64'),
      sha: fileData.sha,
      branch: branch
    };
    
    log('Pushing updated HTML to GitHub...');
    
    const updateResponse = await fetch(getFileUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${githubToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent': 'Appwrite-Function'
      },
      body: JSON.stringify(updatePayload)
    });
    
    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      throw new Error(`GitHub API error (update): ${updateResponse.status} - ${errorText}`);
    }
    
    const updateResult = await updateResponse.json();
    log('GitHub update successful. Commit SHA:', updateResult.commit.sha);
    
    return res.json({
      success: true,
      message: 'HTML updated successfully on GitHub, Vercel will auto-deploy',
      updatedText: updatedDocument.text,
      commitSha: updateResult.commit.sha,
      siteUrl: 'https://anil-tweet.vercel.app/',
      timestamp: new Date().toISOString()
    });
    
  } catch (err) {
    error('Error updating HTML via GitHub:', err);
    return res.json({
      success: false,
      error: 'Failed to update HTML via GitHub',
      details: err.message
    }, 500);
  }
};