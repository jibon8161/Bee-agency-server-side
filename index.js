require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const express = require("express");
const cors = require("cors");

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Get MongoDB URI from environment variables
const uri = process.env.MONGODB_URI;

if (!uri) {
  console.error("❌ MONGODB_URI is not defined in environment variables");
  process.exit(1);
}

// Cache MongoDB connection globally
let cachedClient = null;
let cachedDb = null;

async function connectToDatabase() {
  if (cachedClient && cachedDb) {
    console.log("🔄 Using cached database connection");
    return { client: cachedClient, database: cachedDb };
  }

  console.log("🔄 Creating new database connection...");

  const client = new MongoClient(uri, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    },
    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 10000,
  });

  try {
    await client.connect();
    const database = client.db("BUSINESS_DB");

    // Cache the connection
    cachedClient = client;
    cachedDb = database;

    console.log("✅ Connected to MongoDB successfully!");
    return { client, database };
  } catch (error) {
    console.error("❌ MongoDB connection failed:", error.message);
    throw error;
  }
}

// Health check endpoint
app.get("/status", async (req, res) => {
  try {
    const { database } = await connectToDatabase();
    await database.command({ ping: 1 });
    res.json({
      success: true,
      message: "Database connected successfully",
      timestamp: new Date(),
      environment: process.env.NODE_ENV || "development",
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      message: "Database connection failed",
      error: error.message,
    });
  }
});

// Get all blogs
app.get("/blogs", async (req, res) => {
  try {
    const { database } = await connectToDatabase();
    const clientsCollection = database.collection("clients_info");

    const blogs = await clientsCollection.find().toArray();

    res.json({
      success: true,
      data: blogs,
      count: blogs.length,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error("Error fetching blogs:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// Get single blog by slug
// Get single blog by slug - Update to include the new fields
app.get("/blogs/:slug", async (req, res) => {
  try {
    const { database } = await connectToDatabase();
    const clientsCollection = database.collection("clients_info");

    const { slug } = req.params;
    const blog = await clientsCollection.findOne({ slug });

    if (!blog) {
      return res.status(404).json({
        success: false,
        message: "Blog not found",
      });
    }

    // Ensure all fields exist even if they're not in the database yet
    const blogWithDefaults = {
      ...blog,
      likes: blog.likes || 0,
      views: blog.views || 0,
      likedBy: blog.likedBy || [],
      tags: blog.tags || [],
      category: blog.category || "",
      authorImage: blog.authorImage || "",
    };

    res.json({
      success: true,
      data: blogWithDefaults,
    });
  } catch (error) {
    console.error("Error fetching blog:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// Create a new blog
// Find this endpoint in your Express server file and update it:
app.post("/postblogs", async (req, res) => {
  try {
    const { database } = await connectToDatabase();
    const clientsCollection = database.collection("clients_info");

    const {
      title,
      slug,
      excerpt,
      coverImage,
      date,
      content,
      author,
      authorImage,
      tags, // Add tags if you have them
      category // Add category if you have it
    } = req.body;

    // Validate required fields
    if (!title || !slug || !excerpt || !coverImage || !date) {
      return res.status(400).json({
        success: false,
        message:
          "Missing required fields: title, slug, excerpt, coverImage, date",
      });
    }

    // Create the new blog with ALL fields
    const newBlog = {
      title,
      slug,
      excerpt,
      coverImage,
      date,
      content: content || "",
      author: author || "Unknown",
      authorImage: authorImage || "",
      tags: tags || [], // Default to empty array
      category: category || "", // Default to empty string
      
      // Add these new fields for stats tracking
      likes: 0,
      views: 0,
      likedBy: [],
      lastViewed: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await clientsCollection.insertOne(newBlog);

    res.status(201).json({
      success: true,
      message: "Blog created successfully",
      data: {
        ...newBlog,
        _id: result.insertedId.toString(),
      },
    });
  } catch (error) {
    console.error("Error creating blog:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create blog",
      error: error.message,
    });
  }
});

// Update a blog
app.put("/blogs/:slug", async (req, res) => {
  try {
    const { database } = await connectToDatabase();
    const clientsCollection = database.collection("clients_info");

    const { slug } = req.params;
    const updateData = req.body;

    const result = await clientsCollection.updateOne(
      { slug },
      { $set: { ...updateData, updatedAt: new Date() } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Blog not found",
      });
    }

    res.json({
      success: true,
      message: "Blog updated successfully",
      data: result,
    });
  } catch (error) {
    console.error("Error updating blog:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update blog",
      error: error.message,
    });
  }
});

// Delete a blog
app.delete("/blogs/:slug", async (req, res) => {
  try {
    const { database } = await connectToDatabase();
    const clientsCollection = database.collection("clients_info");

    const { slug } = req.params;

    const result = await clientsCollection.deleteOne({ slug });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Blog not found",
      });
    }

    res.json({
      success: true,
      message: "Blog deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting blog:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete blog",
      error: error.message,
    });
  }
});

// Root endpoint
app.get("/", (req, res) => {
  res.json({
    message: "Server is running!",
    environment: process.env.NODE_ENV || "development",
    database: cachedClient ? "Connected ✅" : "Disconnected ❌",
    endpoints: [
      "GET /status - Check server and database status",
      "GET /blogs - Get all blogs",
      "GET /blogs/:slug - Get single blog",
      "POST /postblogs - Create new blog",
      "PUT /blogs/:slug - Update blog",
      "DELETE /blogs/:slug - Delete blog",
    ],
  });
});

// Add after your other endpoints in your Express server file

// GET blog stats (likes, views)
// POST - Update blog stats (like/unlike, view) - IMPROVED VERSION
app.post("/blogs/:slug/stats", async (req, res) => {
  try {
    const { database } = await connectToDatabase();
    const clientsCollection = database.collection("clients_info");

    const { slug } = req.params;
    const { action, userIdentifier } = req.body;

    if (!action) {
      return res.status(400).json({
        success: false,
        message: "Action is required"
      });
    }

    let updateQuery = {};
    let options = { returnDocument: 'after' };

    switch (action) {
      case 'view':
        updateQuery = { 
          $inc: { views: 1 },
          $set: { lastViewed: new Date() }
        };
        break;

      case 'like':
        if (!userIdentifier) {
          return res.status(400).json({
            success: false,
            message: "User identifier is required for liking"
          });
        }
        
        updateQuery = {
          $inc: { likes: 1 },
          $addToSet: { likedBy: userIdentifier } // Use $addToSet to prevent duplicates
        };
        break;

      case 'unlike':
        if (!userIdentifier) {
          return res.status(400).json({
            success: false,
            message: "User identifier is required for unliking"
          });
        }
        
        updateQuery = {
          $inc: { likes: -1 },
          $pull: { likedBy: userIdentifier }
        };
        break;

      default:
        return res.status(400).json({
          success: false,
          message: "Invalid action. Use 'like', 'unlike', or 'view'"
        });
    }

    // Use findOneAndUpdate to get the updated document in one operation
    const result = await clientsCollection.findOneAndUpdate(
      { slug },
      updateQuery,
      options
    );

    if (!result.value) {
      return res.status(404).json({
        success: false,
        message: "Blog not found",
      });
    }

    const updatedBlog = result.value;
    const isLiked = updatedBlog.likedBy ? 
      updatedBlog.likedBy.includes(userIdentifier) : false;

    res.json({
      success: true,
      message: `Blog ${action}d successfully`,
      data: {
        likes: updatedBlog.likes || 0,
        views: updatedBlog.views || 0,
        isLiked: isLiked
      }
    });

  } catch (error) {
    console.error("Error updating blog stats:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// POST - Update blog stats (like/unlike, view)
app.post("/blogs/:slug/stats", async (req, res) => {
  try {
    const { database } = await connectToDatabase();
    const clientsCollection = database.collection("clients_info");

    const { slug } = req.params;
    const { action, userIdentifier } = req.body; // action: 'like', 'unlike', 'view'

    if (!action) {
      return res.status(400).json({
        success: false,
        message: "Action is required"
      });
    }

    // Find the blog
    const blog = await clientsCollection.findOne({ slug });

    if (!blog) {
      return res.status(404).json({
        success: false,
        message: "Blog not found",
      });
    }

    let updateQuery = {};
    let isLiked = blog.likedBy ? blog.likedBy.includes(userIdentifier) : false;

    switch (action) {
      case 'view':
        // Increment view count
        updateQuery = { 
          $inc: { views: 1 },
          $set: { 
            lastViewed: new Date(),
            likedBy: blog.likedBy || []
          }
        };
        break;

      case 'like':
        if (!userIdentifier) {
          return res.status(400).json({
            success: false,
            message: "User identifier is required for liking"
          });
        }

        if (!blog.likedBy) {
          // Initialize likedBy array
          updateQuery = { 
            $inc: { likes: 1 },
            $set: { likedBy: [userIdentifier] }
          };
          isLiked = true;
        } else if (!blog.likedBy.includes(userIdentifier)) {
          // Add user to likedBy array
          updateQuery = { 
            $inc: { likes: 1 },
            $push: { likedBy: userIdentifier }
          };
          isLiked = true;
        }
        break;

      case 'unlike':
        if (!userIdentifier) {
          return res.status(400).json({
            success: false,
            message: "User identifier is required for unliking"
          });
        }

        if (blog.likedBy && blog.likedBy.includes(userIdentifier)) {
          updateQuery = { 
            $inc: { likes: -1 },
            $pull: { likedBy: userIdentifier }
          };
          isLiked = false;
        }
        break;

      default:
        return res.status(400).json({
          success: false,
          message: "Invalid action. Use 'like', 'unlike', or 'view'"
        });
    }

    // If no update needed (e.g., trying to like twice)
    if (Object.keys(updateQuery).length === 0) {
      return res.json({
        success: true,
        message: "No update needed",
        data: {
          likes: blog.likes || 0,
          views: blog.views || 0,
          isLiked: blog.likedBy ? blog.likedBy.includes(userIdentifier) : false
        }
      });
    }

    // Update the blog
    const result = await clientsCollection.updateOne(
      { slug },
      updateQuery
    );

    // Get updated blog
    const updatedBlog = await clientsCollection.findOne({ slug });

    res.json({
      success: true,
      message: `Blog ${action}d successfully`,
      data: {
        likes: updatedBlog.likes || 0,
        views: updatedBlog.views || 0,
        isLiked: isLiked
      }
    });

  } catch (error) {
    console.error("Error updating blog stats:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});


// Handle graceful shutdown
process.on("SIGINT", async () => {
  console.log("🔄 Shutting down gracefully...");
  if (cachedClient) {
    await cachedClient.close();
    console.log("✅ MongoDB connection closed.");
  }
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("🔄 Received SIGTERM, shutting down gracefully...");
  if (cachedClient) {
    await cachedClient.close();
    console.log("✅ MongoDB connection closed.");
  }
  process.exit(0);
});

app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`📍 MongoDB URI: ${uri ? "Set ✅" : "Not set ❌"}`);
});
