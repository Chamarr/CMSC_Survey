const fetch = require("node-fetch");
const express = require("express");
const bodyParser = require("body-parser");
const { MongoClient, ServerApiVersion } = require("mongodb");
require("dotenv").config();
const app = express();
const path = require('path');
const portNumber = process.env.PORT;

const prompt = "Stop to shutdown the server: ";
const uri = `mongodb+srv://${process.env.MONGO_DB_USERNAME}:${process.env.MONGO_DB_PASSWORD}@cluster0.kmsu81v.mongodb.net/${process.env.MONGO_DB_NAME}?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
	serverApi: {
		version: ServerApiVersion.v1,
		strict: true,
		deprecationErrors: true,
	},
});
let listOfCourses = [];
pullCSCourses();
client.connect();

const db = client.db(process.env.MONGO_DB_NAME)
const coursesCollection = db.collection(process.env.COURSE_COLLECTION);
const usersCollection = db.collection(process.env.USER_COUNT);
app.set("view engine", "ejs");
app.set("views", "./templates");
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.get("/", async function (req, res) {
	const topCourses = await coursesCollection.find().sort({ count: -1 }).limit(10).toArray();

	
    const { totalUsers } = await usersCollection.findOne({}, { projection: { _id: 0, totalUsers: 1 } });

    const coursesWithPercentage = topCourses.map(course => ({
      _id: course._id,
      count: course.count,
      percentage: (course.count / totalUsers) * 100,
	}));
	
	res.render("index", { courses: coursesWithPercentage, totalUsers });
});

app.get("/survey", function (req, res) {
	res.render("survey", { listOfCourses });
});

app.post("/survey", async function (req, res) {
	const favoriteCourses = Array.isArray(req.body.favoriteCourses)
		? req.body.favoriteCourses
		: [req.body.favoriteCourses];

	favoriteCourses.forEach(async function (course_id) {
		const existingCourse = await coursesCollection.findOne({ _id: course_id });

		if (existingCourse) {
			await coursesCollection.updateOne({ _id: course_id }, { $inc: { count: 1 } });
		} else {
			await coursesCollection.insertOne({ _id: course_id, count: 1 });
		}
	});

	// Increment the total user count
	await usersCollection.updateOne({}, { $inc: { totalUsers: 1 } }, { upsert: true });
	res.render("confirm");
});

app.listen(portNumber);

console.log(`Survey web server is running at Port ${portNumber}`);

function pullCSCourses() {
    fetch("https://api.umd.io/v1/courses/list")
        .then((response) => response.json())
        .then((data) => {
            listOfCourses = data.filter(isUpperLevel).map(course => course.course_id);
        });
}

function isUpperLevel(course) {
    return (course.course_id.includes("CMSC4") || course.course_id === "CMSC320" || course.course_id === "CMSC335" || course.course_id.includes("CMSC38"));
}