import express, { response } from 'express';
import multer from 'multer';
import fs from 'fs';
import axios from 'axios';
import FormData from 'form-data';
import { Octokit } from '@octokit/rest';
import dotenv from 'dotenv';

dotenv.config();

import { main } from './web.js';
import cors from 'cors';
//import pdf from 'pdf-parse';
//const uploadedpath="";

// GitHub Configuration from Environment Variables
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || 'your_github_personal_access_token_here';
const GITHUB_OWNER = process.env.GITHUB_OWNER || 'your_github_username';

const app=express();
app.use(express.json()); app.use(cors(
    {
    origin:'*'
}));
const port = process.env.PORT || 3000;
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/')
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname)
  }
})
const upload = multer({ storage: storage })

app.post('/file',upload.single('file'),async(req,res)=>{
    let htmlContent = null;
    
    try {
        const uploadedpath = req.file.path;
        
        // Extract PDF and generate HTML using Gemini
        console.log('Extracting PDF and generating HTML with Gemini...');
        htmlContent = await extractpdf(uploadedpath);
        console.log('Extracted HTML Content:', htmlContent);
        
        if (!htmlContent) {
            return res.status(500).json({
                success: false,
                error: 'Failed to generate HTML from resume',
                html: null,
                github: null,
                vercel: null
            });
        }
        console.log('✓ HTML generated successfully');
        
        // Generate unique repository name
        const timestamp = Date.now();
        const repoName = `portfolio-${timestamp}`;
        const fileName = 'index.html';
        
        // Try to upload to GitHub (but don't fail if it doesn't work)
        console.log('Uploading to GitHub...');
        try {
            const uploadResult = await createRepoAndUploadHTML(htmlContent, repoName, fileName);
            
            if (!uploadResult.success) {
                // GitHub upload failed, but still send HTML to frontend
                return res.status(200).json({
                    success: true,
                    html: htmlContent,
                    github: {
                        error: 'Failed to upload to GitHub',
                        details: uploadResult.error || 'Unknown error'
                    },
                    vercel: null,
                    timestamp: Date.now()
                });
            }
            
            console.log('✓ Uploaded to GitHub successfully');
            
            // Generate Vercel deployment URL
            const githubRepoUrl = `https://github.com/${GITHUB_OWNER}/${repoName}/tree/${uploadResult.repository.defaultBranch}`;
            const encodedRepoUrl = encodeURIComponent(githubRepoUrl);
            const vercelDeployUrl = `https://vercel.com/new/clone?repository-url=${encodedRepoUrl}`;
            
            console.log('✓ Vercel deployment URL generated');
            
            // Send complete success response
            res.status(200).json({
                success: true,
                html: htmlContent,
                github: {
                    repository: uploadResult.repository.url,
                    branch: uploadResult.repository.defaultBranch,
                    commit: uploadResult.commit
                },
                vercel: {
                    deployUrl: vercelDeployUrl,
                    instructions: 'Click the URL to deploy on Vercel instantly'
                },
                timestamp: uploadResult.timestamp
            });
            fs.unlink(uploadedpath, (err) => { if (err) console.log('Error:', err); });
        } catch (githubError) {
            // GitHub upload threw an error, but we still have HTML
            console.error('GitHub upload error:', githubError.message);
            
            return res.status(200).json({
                success: true,
                html: htmlContent,
                github: {
                    error: 'GitHub upload failed',
                    message: githubError.message,
                    details: githubError.toString()
                },
                vercel: null,
                timestamp: Date.now()
            });
        }
        
    } catch (error) {
        console.error('Error in /file endpoint:', error);
        
        // Send error response with consistent format
        res.status(500).json({
            success: false,
            error: 'Server error',
            message: error.message,
            html: htmlContent,  // Send HTML if we got it before error
            github: null,
            vercel: null
        });
    }
});
// async function extractpdf(filepath){
//     const databuffer = await fs.readFile(filepath);
//     const data= await pdf(databuffer);
// }


async function extractpdf(filepath){ //ocr space api

    const form=new FormData();
form.append('apikey','d4bcd084f588957');
form.append('file',fs.createReadStream(filepath));

    try{
       const response= await axios({
            method:'post',
            url:'https://api.ocr.space/parse/image',
            data: form,
            headers:{
                ...form.getHeaders()
            }
        })
        
        const resume =  response.data.ParsedResults[0].ParsedText
       console.log('Extracted Resume Text:', resume);
       return await main(resume);
    }
    catch(error){
        console.error('Error extracting PDF:',error);
        // Re-throw the error with more context
        throw new Error(`Failed to process PDF: ${error.message}`);
    }
}

// Function to create a new repository and upload HTML file to GitHub
async function createRepoAndUploadHTML(htmlContent, repoName, fileName = 'index.html') {
    try {
        // Validate inputs
        if (!htmlContent || typeof htmlContent !== 'string') {
            throw new Error('Invalid HTML content provided');
        }

        if (!GITHUB_TOKEN || GITHUB_TOKEN === 'your_github_personal_access_token_here') {
            throw new Error('GitHub token not configured. Please set GITHUB_TOKEN variable.');
        }

        if (!GITHUB_OWNER || GITHUB_OWNER === 'your_github_username') {
            throw new Error('GitHub owner not configured. Please set GITHUB_OWNER variable.');
        }

        if (!repoName) {
            throw new Error('Repository name is required');
        }

        console.log('Initializing GitHub upload...');
        
        // Initialize Octokit with authentication
        const octokit = new Octokit({
            auth: GITHUB_TOKEN
        });

        // Verify authentication
        console.log('Verifying GitHub authentication...');
        const { data: authUser } = await octokit.rest.users.getAuthenticated();
        console.log(`✓ Authenticated as: ${authUser.login}`);

        // Create new repository
        console.log(`Creating new repository: ${repoName}...`);
        let repo;
        
        try {
            const { data: newRepo } = await octokit.rest.repos.createForAuthenticatedUser({
                name: repoName,
                description: `Portfolio website generated on ${new Date().toISOString()}`,
                homepage: `https://${GITHUB_OWNER}.github.io/${repoName}`,
                private: false,
                has_issues: false,
                has_projects: false,
                has_wiki: false,
                auto_init: true // Initialize with README to create main branch
            });
            repo = newRepo;
            console.log(`✓ Repository created: ${repo.full_name}`);
        } catch (error) {
            if (error.status === 422 && error.message.includes('already exists')) {
                throw new Error(`Repository "${repoName}" already exists. Please choose a different name.`);
            }
            throw error;
        }

        // Wait a moment for repository initialization
        console.log('Waiting for repository initialization...');
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Create HTML file locally
        const tempFilePath = `./uploads/${fileName}`;
        
        // Ensure uploads directory exists
        if (!fs.existsSync('./uploads')) {
            fs.mkdirSync('./uploads', { recursive: true });
        }
        
        console.log(`Creating local file: ${fileName}...`);
        fs.writeFileSync(tempFilePath, htmlContent, 'utf8');
        console.log('✓ Local file created');

        // Encode content to base64
        const content = Buffer.from(htmlContent).toString('base64');
        
        // Upload file to repository
        const commitMessage = `Add ${fileName} - ${new Date().toISOString()}`;

        console.log(`Uploading ${fileName} to GitHub...`);
        
        const { data: result } = await octokit.rest.repos.createOrUpdateFileContents({
            owner: GITHUB_OWNER,
            repo: repoName,
            path: fileName,
            message: commitMessage,
            content: content,
            committer: {
                name: authUser.name || authUser.login,
                email: authUser.email || `${authUser.login}@users.noreply.github.com`
            },
            author: {
                name: authUser.name || authUser.login,
                email: authUser.email || `${authUser.login}@users.noreply.github.com`
            }
        });

        console.log('✓ File uploaded successfully!');

        // Verify the upload
        console.log('Verifying upload...');
        const { data: verifyFile } = await octokit.rest.repos.getContent({
            owner: GITHUB_OWNER,
            repo: repoName,
            path: fileName
        });

        console.log('✓ Upload verified successfully!');

        // Clean up local file
        try {
            fs.unlinkSync(tempFilePath);
            console.log('✓ Local file cleaned up');
        } catch (error) {
            console.log('⚠ Could not delete local file');
        }

        // Construct URLs
        const htmlUrl = result.content.html_url;
        const rawUrl = `https://raw.githubusercontent.com/${GITHUB_OWNER}/${repoName}/${repo.default_branch}/${fileName}`;

        return {
            success: true,
            message: 'Repository created and file uploaded successfully',
            commit: {
                sha: result.commit.sha,
                url: result.commit.html_url
            },
            file: {
                name: fileName,
                size: verifyFile.size,
                htmlUrl: htmlUrl,
                rawUrl: rawUrl,
                downloadUrl: verifyFile.download_url,
                localPath: tempFilePath
            },
            repository: {
                name: repo.full_name,
                url: repo.html_url,
                cloneUrl: repo.clone_url,
                sshUrl: repo.ssh_url,
                defaultBranch: repo.default_branch
            },
            instructions: 'Use Vercel deployment URL for live site',
            timestamp: new Date().toISOString()
        };

    } catch (error) {
        console.error('Error in GitHub operation:', error);
        
        let errorMessage = 'Unknown error occurred';
        let errorDetails = {};

        if (error.status === 401) {
            errorMessage = 'Authentication failed. Invalid GitHub token.';
        } else if (error.status === 403) {
            errorMessage = 'Permission denied. Token may lack required scopes (public_repo or repo).';
            errorDetails.requiredScopes = ['public_repo', 'repo'];
        } else if (error.status === 404) {
            errorMessage = 'Resource not found or access denied.';
        } else if (error.status === 422) {
            errorMessage = error.message || 'Invalid request. Check repository name and file content.';
        } else {
            errorMessage = error.message;
        }

        return {
            success: false,
            error: errorMessage,
            details: errorDetails,
            timestamp: new Date().toISOString()
        };
    }
}

app.listen(port,()=>{
console.log(`Server is running at http://localhost:${port}`);
});
