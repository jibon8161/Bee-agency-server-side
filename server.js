require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const express = require("express");
const cors = require("cors");

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://Ninja_db_user:N3JD5TyTAzit8ELd@work.lzfyzuo.mongodb.net/?retryWrites=true&w=majority&appName=Work`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
  serverSelectionTimeoutMS: 10000,
  connectTimeoutMS: 10000,
});

let database;
let clientsCollection;
let blogsCollection;
let isConnected = false;
let connectionError = null;

async function run() {
  try {
    console.log("🔄 Connecting to MongoDB...");
    await client.connect();

    database = client.db("BUSINESS_DB");
    clientsCollection = database.collection("clients_info");
    isConnected = true;

    console.log("✅ Connected to MongoDB!");
    console.log("✅ Database and collection ready!");

    const count = await clientsCollection.countDocuments();
    console.log(`📊 Collection has ${count} documents`);
  } catch (error) {
    console.error("❌ MongoDB connection failed:", error.message);
    connectionError = error.message;
    isConnected = false;
  }
}

run();

// app.get("/clients", async (req, res) => {
//   try {
//     if (!isConnected || !clientsCollection) {
//       return res.status(503).json({
//         success: false,
//         message: "Database not connected yet. Please wait...",
//         error: connectionError,
//         status: "connecting",
//       });
//     }

//     const clients = await clientsCollection.find().toArray();
//     res.json({
//       success: true,
//       message: "All clients data retrieved successfully",
//       data: clients,
//       count: clients.length,
//       timestamp: new Date(),
//     });
//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       message: "Failed to fetch clients data",
//       error: error.message,
//     });
//   }
// });

// app.get("/status", (req, res) => {
//   res.json({
//     server: "Running ✅",
//     database: isConnected ? "Connected ✅" : "Disconnected ❌",
//     error: connectionError,
//     databaseName: "BUSINESS_DB",
//     collectionName: "clients_info",
//   });
// });



app.get("/blogs", async (req, res) => {
  try {
    if (!isConnected || !clientsCollection) {
      return res.status(503).json({
        success: false,
        message: "Database not connected yet. Please wait...",
      });
    }

    const blogs = await clientsCollection.find().toArray();
    res.json({
      success: true,
      data: blogs,
      count: blogs.length,
      timestamp: new Date(),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});



app.get("/blogs/:slug", async (req, res) => {
  try {
    if (!isConnected || !clientsCollection) {
      return res.status(503).json({
        success: false,
        message: "Database not connected yet. Please wait...",
      });
    }

    const { slug } = req.params;
    const blog = await clientsCollection.findOne({ slug });

    if (!blog) {
      return res
        .status(404)
        .json({ success: false, message: "Blog not found" });
    }

    res.json({ success: true, data: blog });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /blog - Add a new blog
app.post("/postblogs", async (req, res) => {
  try {
    if (!isConnected || !clientsCollection) {
      return res.status(503).json({
        success: false,
        message: "Database not connected yet. Please wait...",
        error: connectionError,
      });
    }

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
    };

    const result = await clientsCollection.insertOne(newBlog);

    res.status(201).json({
      success: true,
      message: "Blog inserted successfully into clientsCollection",
      data: { ...newBlog, _id: result.insertedId.toString() },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to insert blog",
      error: error.message,
    });
  }
});




app.get("/", (req, res) => {
  res.json({
    message: "Server is running!",
    databaseStatus: isConnected ? "Connected ✅" : "Disconnected ❌",
    endpoints: [
      "/status - Check server and database status",
      "/clients - Get all clients",
    ],
  });
});

app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
  console.log(`📍 Test endpoints:`);
  console.log(`   http://localhost:${port}/status`);
  console.log(`   http://localhost:${port}/clients`);
});
