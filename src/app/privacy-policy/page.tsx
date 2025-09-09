import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-3xl font-bold text-gray-900">Privacy Policy</CardTitle>
            <p className="text-gray-600 mt-2">Effective Date: June 01, 2025</p>
          </CardHeader>
          <CardContent className="prose max-w-none">
            <p className="text-gray-700 mb-6">
              Thank you for using My Class Log. Your privacy is important to us. This Privacy Policy
              explains how we collect, use, disclose, and protect your information when you use our
              web-based application and related services ("Services").
            </p>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">1. Who We Are</h2>
              <p className="text-gray-700">
                My Class Log is a software-as-a-service (SaaS) platform designed for educators to track the
                number of times and total time out of class for each student (not including attendance).
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">2. Information We Collect</h2>
              <p className="text-gray-700 mb-4">We collect the following types of information:</p>
              
              <div className="ml-4">
                <h3 className="text-lg font-semibold text-gray-800 mb-2">a. Personal Information</h3>
                <ul className="list-disc ml-6 mb-4 text-gray-700">
                  <li>Name, email address, and password when teachers sign up</li>
                </ul>

                <h3 className="text-lg font-semibold text-gray-800 mb-2">b. Student Data</h3>
                <ul className="list-disc ml-6 mb-4 text-gray-700">
                  <li>Student names or identifiers</li>
                </ul>

                <h3 className="text-lg font-semibold text-gray-800 mb-2">c. Usage Information</h3>
                <ul className="list-disc ml-6 mb-4 text-gray-700">
                  <li>Browser type, operating system, IP address</li>
                  <li>Date/time of access, pages visited, and user actions</li>
                </ul>

                <h3 className="text-lg font-semibold text-gray-800 mb-2">d. Cookies & Tracking Technologies</h3>
                <p className="text-gray-700 ml-6">
                  We use cookies to improve user experience, remember preferences, and analyze usage.
                </p>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">3. How We Use Your Information</h2>
              <p className="text-gray-700 mb-4">We use collected data to:</p>
              <ul className="list-disc ml-6 text-gray-700 space-y-1">
                <li>Provide and maintain the Services</li>
                <li>Personalize the user experience</li>
                <li>Communicate with users regarding updates or support</li>
                <li>Improve functionality and performance</li>
                <li>Ensure data integrity and system security</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">4. How We Share Your Information</h2>
              <p className="text-gray-700 mb-4">
                We do not sell or rent your personal information or student data. We may share
                information only with:
              </p>
              <ul className="list-disc ml-6 text-gray-700 space-y-1">
                <li>Authorized third-party service providers (e.g., hosting, analytics) under strict confidentiality agreements.</li>
                <li>Legal authorities when required by law or to protect rights/safety.</li>
                <li>School administrators if applicable and authorized by you the user.</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">5. Data Security</h2>
              <p className="text-gray-700 mb-4">
                We use third party providers to implement industry-standard technical and organizational
                safeguards including:
              </p>
              <ul className="list-disc ml-6 text-gray-700 space-y-1">
                <li>Data encryption (in transit and at rest)</li>
                <li>Secure login/authentication protocols</li>
                <li>Regular security audits and monitoring</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">7. Your Rights & Choices</h2>
              <p className="text-gray-700 mb-4">Teachers can:</p>
              <ul className="list-disc ml-6 text-gray-700 space-y-1">
                <li>Access and update their account information</li>
                <li>Request deletion of their account or associated data</li>
                <li>Export classroom data upon request</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">8. Data Retention</h2>
              <p className="text-gray-700">
                We retain user and student data only as long as necessary to provide services. Users may
                request earlier deletion of their data.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">9. International Users</h2>
              <p className="text-gray-700">
                If you are accessing our service from outside the United States, be aware that your
                information may be transferred to and stored in the U.S.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">10. Changes to This Policy</h2>
              <p className="text-gray-700">
                We may update this Privacy Policy periodically. If we make significant changes, we will
                notify users via email or an in-app message.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">11. Contact Us</h2>
              <p className="text-gray-700 mb-4">
                If you have questions or concerns about this Privacy Policy, please contact:
              </p>
              <div className="bg-gray-100 p-4 rounded-lg">
                <p className="font-semibold text-gray-800">My Class Log Support Team</p>
                <p className="text-gray-700">Email: admin@myclasslog.com</p>
                <p className="text-gray-700">Website: www.myclasslog.com</p>
              </div>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 