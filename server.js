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

    res.json({
      success: true,
      data: blog,
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
    } = req.body;

    // Validate required fields
    if (!title || !slug || !excerpt || !coverImage || !date) {
      return res.status(400).json({
        success: false,
        message:
          "Missing required fields: title, slug, excerpt, coverImage, date",
      });
    }

    const newBlog = {
      title,
      slug,
      excerpt,
      coverImage,
      date,
      content: content || "",
      author: author || "Unknown",
      authorImage: authorImage || "",
      createdAt: new Date(),
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
