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

    // Call Vercel API to update the HTML
    // IMPORTANT: Replace this URL with your actual Vercel deployment URL
    const vercelUrl = 'https://anil-tweet.vercel.app/api/update'; 
    const updateSecret = 'anil-twt-july-2025'; // Same secret as in Vercel
    
    const vercelPayload = {
      text: updatedDocument.text,
      timestamp: updatedDocument.timestamp || new Date().toISOString(),
      secret: updateSecret
    };

    log('Calling Vercel API with payload:', JSON.stringify(vercelPayload));

    try {
      const response = await fetch(vercelUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(vercelPayload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Vercel API error: ${response.status} - ${errorText}`);
      }

      const vercelResult = await response.json();
      log('Vercel update successful:', JSON.stringify(vercelResult));

      return res.json({
        success: true,
        message: 'HTML updated successfully on Vercel',
        updatedText: updatedDocument.text,
        vercelResponse: vercelResult,
        siteUrl: vercelUrl.replace('/api/update', ''), // Your site URL
        timestamp: new Date().toISOString()
      });

    } catch (fetchError) {
      error('Error calling Vercel API:', fetchError);
      return res.json({
        success: false,
        error: 'Failed to update Vercel site',
        details: fetchError.message
      }, 500);
    }

  } catch (err) {
    error('Unexpected error in function execution:', err);
    return res.json({
      success: false,
      error: 'Internal server error',
      details: err.message
    }, 500);
  }
};