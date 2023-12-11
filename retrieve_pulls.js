const express = require('express');
const axios = require('axios');
const saveToFirestore = require('./save_to_firestore.js');

const app = express();
const port = 8100;

const githubAPIEndpoint = 'https://api.github.com/repos/nodejs/node/pulls';

app.get('/retrieve-pulls', async (req, res) => {
  const targetDate = req.query.targetDate; // Add a query parameter for the target date

  try {
    // Fetch pulls from GitHub API
    const pulls = await fetchPullRequestsUntilDate(githubAPIEndpoint, targetDate);
    console.log("pulls since ",targetDate," successfully fetched from github.");

    // Extract relevant fields from each pull request
    const formattedPulls = pulls.map(pull => ({
      id: pull.id,
      user: pull.user,
      requested_reviewers: pull.requested_reviewers,
      created_at: pull.created_at
    }));

    // Save data to Firestore using the saveToFirestore function
    await saveToFirestore(formattedPulls);
    console.log("Pull requests successfully updated in Firestore.");

    res.json("Pull requests successfully updated in Firestore.");
    //res.json({
    //    message: "Pull requests successfully updated in Firestore.",
    //    pulls: formattedPulls
    //  });
  } catch (error) {
    console.error('Error fetching data from GitHub API:', error.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Helper function to fetch pulls until a specific date
async function fetchPullRequestsUntilDate(apiEndpoint, targetDate) {
    let page = 1;
    let cutoff = 0;
    let pulls = [];
    let pullsOnOrBeforeCutoff = [];
  
    while (true) {
      const url = `${apiEndpoint}?page=${page}`;
      try {
        const response = await axios.get(url);
  
        // Check if the response is empty
        if (response.data.length === 0) {
          cutoff++;
          break; // Break the loop if the response is empty
        }
  
        // Check if the last pull in the response has the 'created_at' property
        const lastPull = response.data[response.data.length - 1];
        if (!lastPull || !lastPull.created_at) {
          cutoff++;
          break; // Break the loop if 'created_at' is missing
        }
  
        // Check if the last pull is on or before the target date
        if (new Date(lastPull.created_at) < new Date(targetDate)) {
          cutoff++;
        }
  
        // Concatenate the new pulls to the existing array
        pulls = pulls.concat(response.data);
  
        if (cutoff === 1) {
          break;
        }
  
        // Increment the page number for the next request
        page++;
      } catch (error) {
        console.error('Error fetching pulls:', error.message);
        break;
      }
    }
  
    console.log('Before cutting length: ', pulls.length);
  
    // Filter pulls to keep only those on or before the cutoff date
    pullsOnOrBeforeCutoff = pulls.filter(
      (pull) => new Date(pull.created_at) >= new Date(targetDate)
    );
    console.log('After cutting length: ', pullsOnOrBeforeCutoff.length);
  
    return pullsOnOrBeforeCutoff;
}

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
