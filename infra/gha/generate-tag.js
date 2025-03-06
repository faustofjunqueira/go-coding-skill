
async function generateTag({ github, context, core, glob }, major, minor, patch, preRelease, tag) {
    try {
      console.log(major, minor, patch, preRelease, tag);
    } catch (error) {
      core.setFailed(error.message);
    }
  }
  

module.exports = generateTag;
