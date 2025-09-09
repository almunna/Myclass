import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-3xl font-bold text-gray-900">Terms and Conditions</CardTitle>
            <p className="text-gray-600 mt-2">Effective Date: June 01, 2025</p>
          </CardHeader>
          <CardContent className="prose max-w-none">
            <p className="text-gray-700 mb-6">
              Welcome to My Class Log ("we", "us", or "our"). These Terms and Conditions ("Terms")
              govern your use of our web application located at myclasslog.com and any related services
              (collectively, the "Service").
            </p>
            <p className="text-gray-700 mb-6">
              Please read these Terms carefully before using the Service. By accessing or using the
              Service, you agree to be bound by these Terms. If you do not agree, please do not use our
              Service.
            </p>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">1. Eligibility</h2>
              <p className="text-gray-700">
                You must be at least 18 years old to use this Service. By using the Service, you represent
                and warrant that you meet these requirement.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">2. Use of the Service</h2>
              <p className="text-gray-700 mb-4">You agree to use the Service only for lawful purposes and in accordance with these Terms. You may not:</p>
              <ul className="list-disc ml-6 text-gray-700 space-y-2">
                <li>Violate any applicable laws or regulations</li>
                <li>Use the Service for any unauthorized or unlawful purpose</li>
                <li>Distribute viruses, malware, or other harmful software</li>
                <li>Attempt to gain unauthorized access to the Service or its related systems</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">3. Account Registration</h2>
              <p className="text-gray-700">
                To use the features, you have to register an account. You agree to provide accurate, current,
                and complete information and to keep it updated. You are responsible for maintaining the
                confidentiality of your account credentials.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">4. User Content</h2>
              <p className="text-gray-700">
                You are solely responsible for your content and represent that you have all necessary rights
                to share it.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">5. Intellectual Property</h2>
              <p className="text-gray-700">
                All content and materials provided by us, including but not limited to text, graphics, logos,
                and software, are our property or the property of our licensors and are protected by
                intellectual property laws. You may not copy, modify, distribute, or exploit them without our
                written permission.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">6. Termination</h2>
              <p className="text-gray-700">
                We reserve the right to suspend or terminate your account or access to the Service at our
                sole discretion, without notice, for conduct that we believe violates these Terms or is
                harmful to us or others.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">7. Disclaimers</h2>
              <p className="text-gray-700">
                The Service is provided "as is" and "as available." We do not make any warranties, express
                or implied, including warranties of merchantability, fitness for a particular purpose, or non-
                infringement.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">8. Limitation of Liability</h2>
              <p className="text-gray-700">
                To the fullest extent permitted by law, we shall not be liable for any indirect, incidental,
                special, or consequential damages arising out of or in connection with your use of the
                Service.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">9. Changes to These Terms</h2>
              <p className="text-gray-700">
                We may update these Terms from time to time. If we make changes, we will notify you by
                updating the effective date or providing other appropriate notice. Your continued use of the
                Service after changes means you accept the updated Terms.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">10. Governing Law</h2>
              <p className="text-gray-700">
                These Terms are governed by the laws of the State of Florida, without regard to its conflict
                of law principles. Any disputes shall be resolved in the courts of St. John's County, Florida.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">11. Contact Us</h2>
              <p className="text-gray-700 mb-4">
                If you have questions or concerns about these Terms, please contact us at:
              </p>
              <div className="bg-gray-100 p-4 rounded-lg">
                <p className="text-gray-700">Email: admin@myclasslog.com</p>
              </div>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 