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
app.get("/blogs/:slug/stats", async (req, res) => {
  try {
    const { database } = await connectToDatabase();
    const clientsCollection = database.collection("clients_info");

    const { slug } = req.params;

    // Find the blog
    const blog = await clientsCollection.findOne({ slug });

    if (!blog) {
      return res.status(404).json({
        success: false,
        message: "Blog not found",
      });
    }

    // Return stats
    res.json({
      success: true,
      data: {
        likes: blog.likes || 0,
        views: blog.views || 0,
        likedBy: blog.likedBy || []
      }
    });
  } catch (error) {
    console.error("Error fetching blog stats:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});


// Add these endpoints after your existing stats endpoints

// ======================
// COMMENTS ENDPOINTS
// ======================

// GET all comments for a blog post
app.get("/blogs/:slug/comments", async (req, res) => {
  try {
    const { database } = await connectToDatabase();
    const commentsCollection = database.collection("comments");
    
    const { slug } = req.params;
    const { sort = "newest" } = req.query;
    
    // Find all comments for this blog post (top-level comments)
    let query = { 
      blogSlug: slug,
      parentId: null,
      isDeleted: { $ne: true }
    };
    
    // Sort options
    let sortOption = { createdAt: -1 }; // Default: newest first
    if (sort === "popular") {
      sortOption = { likes: -1, createdAt: -1 }; // Most liked first
    }
    
    const comments = await commentsCollection
      .find(query)
      .sort(sortOption)
      .toArray();
    
    // Get replies for each comment
    const commentsWithReplies = await Promise.all(
      comments.map(async (comment) => {
        const replies = await commentsCollection
          .find({ 
            parentId: comment._id.toString(),
            isDeleted: { $ne: true }
          })
          .sort({ createdAt: 1 }) // Oldest replies first
          .toArray();
        
        return {
          ...comment,
          replies: replies || []
        };
      })
    );
    
    res.json({
      success: true,
      data: commentsWithReplies,
      count: comments.length
    });
    
  } catch (error) {
    console.error("Error fetching comments:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// POST - Create a new comment or reply
app.post("/blogs/:slug/comments", async (req, res) => {
  try {
    const { database } = await connectToDatabase();
    const commentsCollection = database.collection("comments");
    
    const { slug } = req.params;
    const { 
      content, 
      parentId = null, 
      authorName, 
      authorEmail,
      authorAvatar 
    } = req.body;
    
    // Validate required fields
    if (!content || !content.trim()) {
      return res.status(400).json({
        success: false,
        message: "Comment content is required"
      });
    }
    
    if (!authorName || !authorEmail) {
      return res.status(400).json({
        success: false,
        message: "Author name and email are required"
      });
    }
    
    // Generate a unique identifier for anonymous users
    const userIdentifier = req.headers['x-user-id'] || 
                         `anon_${Math.random().toString(36).substr(2, 9)}`;
    
    // Check if this is a reply and parent exists
    if (parentId) {
      const parentComment = await commentsCollection.findOne({ 
        _id: new ObjectId(parentId),
        blogSlug: slug
      });
      
      if (!parentComment) {
        return res.status(404).json({
          success: false,
          message: "Parent comment not found"
        });
      }
    }
    
    // Create new comment
    const newComment = {
      blogSlug: slug,
      content: content.trim(),
      parentId: parentId,
      author: {
        name: authorName.trim(),
        email: authorEmail.trim(),
        avatar: authorAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(authorName.trim())}&background=random`
      },
      likes: 0,
      likedBy: [],
      isEdited: false,
      isDeleted: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      userIdentifier: userIdentifier // Track anonymous user
    };
    
    const result = await commentsCollection.insertOne(newComment);
    
    const createdComment = {
      ...newComment,
      _id: result.insertedId.toString()
    };
    
    res.status(201).json({
      success: true,
      message: parentId ? "Reply posted successfully" : "Comment posted successfully",
      data: createdComment
    });
    
  } catch (error) {
    console.error("Error posting comment:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// POST - Like/unlike a comment
app.post("/blogs/:slug/comments/:commentId/like", async (req, res) => {
  try {
    const { database } = await connectToDatabase();
    const commentsCollection = database.collection("comments");
    
    const { slug, commentId } = req.params;
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User identifier is required"
      });
    }
    
    // Find the comment
    const comment = await commentsCollection.findOne({
      _id: new ObjectId(commentId),
      blogSlug: slug,
      isDeleted: { $ne: true }
    });
    
    if (!comment) {
      return res.status(404).json({
        success: false,
        message: "Comment not found"
      });
    }
    
    const isLiked = comment.likedBy && comment.likedBy.includes(userId);
    let updateQuery;
    
    if (isLiked) {
      // Unlike
      updateQuery = {
        $inc: { likes: -1 },
        $pull: { likedBy: userId }
      };
    } else {
      // Like
      updateQuery = {
        $inc: { likes: 1 },
        $push: { likedBy: userId }
      };
    }
    
    // Update the comment
    await commentsCollection.updateOne(
      { _id: new ObjectId(commentId) },
      updateQuery
    );
    
    // Get updated comment
    const updatedComment = await commentsCollection.findOne({
      _id: new ObjectId(commentId)
    });
    
    res.json({
      success: true,
      message: isLiked ? "Comment unliked" : "Comment liked",
      data: {
        likes: updatedComment.likes,
        likedBy: updatedComment.likedBy || []
      }
    });
    
  } catch (error) {
    console.error("Error liking comment:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// PUT - Update a comment
app.put("/blogs/:slug/comments/:commentId", async (req, res) => {
  try {
    const { database } = await connectToDatabase();
    const commentsCollection = database.collection("comments");
    
    const { slug, commentId } = req.params;
    const { content, userIdentifier } = req.body;
    
    if (!content || !content.trim()) {
      return res.status(400).json({
        success: false,
        message: "Comment content is required"
      });
    }
    
    if (!userIdentifier) {
      return res.status(400).json({
        success: false,
        message: "User identifier is required to edit"
      });
    }
    
    // Find the comment
    const comment = await commentsCollection.findOne({
      _id: new ObjectId(commentId),
      blogSlug: slug,
      isDeleted: { $ne: true }
    });
    
    if (!comment) {
      return res.status(404).json({
        success: false,
        message: "Comment not found"
      });
    }
    
    // Verify user can edit (check userIdentifier or implement proper auth)
    if (comment.userIdentifier !== userIdentifier) {
      return res.status(403).json({
        success: false,
        message: "You can only edit your own comments"
      });
    }
    
    // Update the comment
    const result = await commentsCollection.updateOne(
      { _id: new ObjectId(commentId) },
      {
        $set: {
          content: content.trim(),
          isEdited: true,
          updatedAt: new Date()
        }
      }
    );
    
    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Comment not found"
      });
    }
    
    // Get updated comment
    const updatedComment = await commentsCollection.findOne({
      _id: new ObjectId(commentId)
    });
    
    res.json({
      success: true,
      message: "Comment updated successfully",
      data: updatedComment
    });
    
  } catch (error) {
    console.error("Error updating comment:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// DELETE - Soft delete a comment
app.delete("/blogs/:slug/comments/:commentId", async (req, res) => {
  try {
    const { database } = await connectToDatabase();
    const commentsCollection = database.collection("comments");
    
    const { slug, commentId } = req.params;
    const { userIdentifier } = req.body;
    
    if (!userIdentifier) {
      return res.status(400).json({
        success: false,
        message: "User identifier is required to delete"
      });
    }
    
    // Find the comment
    const comment = await commentsCollection.findOne({
      _id: new ObjectId(commentId),
      blogSlug: slug,
      isDeleted: { $ne: true }
    });
    
    if (!comment) {
      return res.status(404).json({
        success: false,
        message: "Comment not found"
      });
    }
    
    // Verify user can delete (check userIdentifier or implement proper auth)
    if (comment.userIdentifier !== userIdentifier) {
      return res.status(403).json({
        success: false,
        message: "You can only delete your own comments"
      });
    }
    
    // Soft delete - mark as deleted
    const result = await commentsCollection.updateOne(
      { _id: new ObjectId(commentId) },
      {
        $set: {
          isDeleted: true,
          content: "This comment has been deleted.",
          updatedAt: new Date()
        }
      }
    );
    
    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Comment not found"
      });
    }
    
    res.json({
      success: true,
      message: "Comment deleted successfully"
    });
    
  } catch (error) {
    console.error("Error deleting comment:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// GET - Get comment count for a blog
app.get("/blogs/:slug/comments/count", async (req, res) => {
  try {
    const { database } = await connectToDatabase();
    const commentsCollection = database.collection("comments");
    
    const { slug } = req.params;
    
    const count = await commentsCollection.countDocuments({
      blogSlug: slug,
      parentId: null,
      isDeleted: { $ne: true }
    });
    
    res.json({
      success: true,
      data: { count }
    });
    
  } catch (error) {
    console.error("Error getting comment count:", error);
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
