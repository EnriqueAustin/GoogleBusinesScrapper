"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Save } from "lucide-react";

export default function SettingsPage() {
    const [settings, setSettings] = useState({
        headless: "false",
        enrichWebsitesDuringScrape: "false",
        maxResultsPerQuery: 30,
        maxScrollAttempts: 15,
        proxyUrl: "",
    });
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const res = await axios.get("http://localhost:3001/api/settings");
                // Merge database settings over defaults
                const dbSettings = res.data;
                setSettings((prev) => ({
                    ...prev,
                    headless: dbSettings.headless ?? prev.headless,
                    enrichWebsitesDuringScrape: dbSettings.enrichWebsitesDuringScrape ?? prev.enrichWebsitesDuringScrape,
                    maxResultsPerQuery: dbSettings.maxResultsPerQuery ?? prev.maxResultsPerQuery,
                    maxScrollAttempts: dbSettings.maxScrollAttempts ?? prev.maxScrollAttempts,
                    proxyUrl: dbSettings.proxyUrl ?? prev.proxyUrl,
                }));
            } catch (err) {
                console.error("Failed to load settings", err);
            } finally {
                setLoading(false);
            }
        };

        fetchSettings();
    }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            await axios.post("http://localhost:3001/api/settings", settings);
            alert("Settings saved successfully! They will apply to the next scraping job.");
        } catch (err) {
            console.error("Failed to save settings", err);
            alert("Failed to save settings");
        } finally {
            setSaving(false);
        }
    };

    const handleChange = (key: string, value: any) => {
        setSettings((prev) => ({ ...prev, [key]: value }));
    };

    if (loading) return <div className="text-center py-10">Loading settings...</div>;

    return (
        <div className="space-y-6 max-w-3xl mx-auto">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Global Settings</h1>
                    <p className="text-muted-foreground">Configure global options for the scraping engine.</p>
                </div>
                <Button onClick={handleSave} disabled={saving} className="gap-2">
                    <Save className="h-4 w-4" /> {saving ? "Saving..." : "Save Settings"}
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Browser & Proxy</CardTitle>
                    <CardDescription>Setup how the Playwright browser launches and connects to the internet.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-3">
                        <label className="text-sm font-medium">Headless Mode</label>
                        <div className="flex items-center gap-2">
                            <Checkbox
                                id="headless"
                                checked={settings.headless === "true"}
                                onCheckedChange={(c) => handleChange("headless", c ? "true" : "false")}
                            />
                            <label htmlFor="headless" className="text-sm text-muted-foreground">
                                Run browser invisibly (consumes less memory but might increase detection risk).
                            </label>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <label className="text-sm font-medium">HTTP/S Proxy URL (Optional)</label>
                        <Input
                            value={settings.proxyUrl}
                            onChange={(e) => handleChange("proxyUrl", e.target.value)}
                            placeholder="http://user:pass@proxy-server.com:8080"
                        />
                        <p className="text-xs text-muted-foreground">Route browser traffic through a proxy to avoid IP bans.</p>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Behavior Limits</CardTitle>
                    <CardDescription>Control how deeply the scraper extracts data per query.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                    <div className="flex gap-4 items-center">
                        <div className="flex-1 space-y-2">
                            <label className="text-sm font-medium">Max Results Per Query</label>
                            <Input
                                type="number"
                                value={settings.maxResultsPerQuery}
                                onChange={(e) => handleChange("maxResultsPerQuery", parseInt(e.target.value) || 0)}
                            />
                        </div>
                        <div className="flex-1 space-y-2">
                            <label className="text-sm font-medium">Max Scroll Attempts</label>
                            <Input
                                type="number"
                                value={settings.maxScrollAttempts}
                                onChange={(e) => handleChange("maxScrollAttempts", parseInt(e.target.value) || 0)}
                            />
                        </div>
                    </div>

                    <div className="space-y-3 pt-4 border-t">
                        <label className="text-sm font-medium">In-line Enrichment</label>
                        <div className="flex items-center gap-2">
                            <Checkbox
                                id="enrich"
                                checked={settings.enrichWebsitesDuringScrape === "true"}
                                onCheckedChange={(c) => handleChange("enrichWebsitesDuringScrape", c ? "true" : "false")}
                            />
                            <label htmlFor="enrich" className="text-sm text-muted-foreground">
                                Automatically scrape website contents for socials and emails <i>during</i> the Maps scraping phase. (Warning: Makes scraping significantly slower).
                            </label>
                        </div>
                    </div>
                </CardContent>
            </Card>

        </div>
    );
}
